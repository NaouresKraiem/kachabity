import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, type Row, ok, params, readBody, route, zDate, zId } from '@/lib/erp/api';
import { PO_STATUSES } from '@/lib/erp/constants';
import { invalidateCatalog } from '@/lib/catalog-cache';

export const dynamic = 'force-dynamic';

/**
 * Purchase orders and price requests (status rfq: the prices are the supplier's quote). Lines are
 * product variants (stock for sale) or raw materials. Goods arrive through receipts
 * (/api/purchasing/receipts), which only add to stock once validated.
 */

const LINE_SELECT = 'id, variant_id, material_id, description, quantity, unit_cost, vat_rate, received_quantity, rejected_quantity, position, variant:product_variants(sku, product:products(name), colors(name, display_name), sizes(name)), material:raw_materials(name, unit)';

// GET ?id= (with lines, receipts and bills) or the list: ?status=&supplier_id=
export const GET = route('purchasing-orders', async (request) => {
    const q = params(request);
    const id = q.get('id');
    if (id) {
        const [po, lines, receipts, bills] = await Promise.all([
            supabase.from('purchase_orders').select('*, supplier:suppliers(id, name, phone, email, payment_terms_days), location:locations(id, name)').eq('id', id).is('deleted_at', null).maybeSingle(),
            supabase.from('purchase_order_lines').select(LINE_SELECT).eq('purchase_order_id', id).is('deleted_at', null).order('position'),
            supabase.from('purchase_receipts').select('*, lines:purchase_receipt_lines(*)').eq('purchase_order_id', id).is('deleted_at', null).order('created_at'),
            supabase.from('bills').select('id, number, supplier_reference, total, paid_amount, status, bill_date, due_date').eq('purchase_order_id', id).is('deleted_at', null),
        ]);
        const order = must(po);
        if (!order) throw new HttpError('This purchase order no longer exists.', 404);
        return ok({ ...order, lines: must(lines), receipts: must(receipts), bills: must(bills) });
    }
    let query = supabase.from('purchase_orders').select('*, supplier:suppliers(name), lines:purchase_order_lines(quantity, received_quantity, deleted_at)').is('deleted_at', null);
    if (q.get('status')) query = query.eq('status', q.get('status')!);
    if (q.get('supplier_id')) query = query.eq('supplier_id', q.get('supplier_id')!);
    const rows = must<Row[]>(await query.order('order_date', { ascending: false }).order('created_at', { ascending: false }).limit(q.int('limit', 300, 1000)));
    return ok(rows.map((row) => {
        const lines = (row.lines ?? []).filter((l: { deleted_at: string | null }) => !l.deleted_at);
        const ordered = lines.reduce((s: number, l: { quantity: number }) => s + Number(l.quantity), 0);
        const received = lines.reduce((s: number, l: { received_quantity: number }) => s + Number(l.received_quantity), 0);
        return { ...row, lines: undefined, line_count: lines.length, ordered_quantity: ordered, received_quantity: received };
    }));
});

const lineSchema = z.object({
    id: zId.optional(),
    variant_id: zId.nullish(),
    material_id: zId.nullish(),
    description: z.string().trim().max(250).default(''),
    quantity: z.number().positive().max(1_000_000),
    unit_cost: z.number().nonnegative().max(1_000_000),
    vat_rate: z.number().min(0).max(100).default(19),
}).refine((l) => l.variant_id || l.material_id || l.description, 'Each line needs a product, a material or a description');

const saveSchema = z.object({
    id: zId.optional(),
    supplier_id: zId,
    status: z.enum(['draft', 'rfq', 'ordered']).optional(),
    order_date: zDate.optional(),
    expected_date: zDate.nullable().optional(),
    location_id: zId.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    lines: z.array(lineSchema).min(1).max(300),
});

// POST — create or update (with id) a purchase order and its lines.
export const POST = route('purchasing-orders', async (request, actor) => {
    const body = await readBody(request, saveSchema);
    const { id, lines, ...po } = body;
    const data = must(await supabase.rpc('save_purchase_order', {
        p_id: id ?? null,
        p_po: po,
        p_lines: lines,
        p_actor: actor.userId,
        p_actor_email: actor.email,
    }));
    return ok(data, id ? 200 : 201);
});

// PATCH { id, status } — send a price request, place the order, or cancel.
export const PATCH = route('purchasing-orders', async (request) => {
    const body = await readBody(request, z.object({ id: zId, status: z.enum(PO_STATUSES) }));
    const po = must(await supabase.from('purchase_orders').select('status').eq('id', body.id).is('deleted_at', null).maybeSingle());
    if (!po) throw new HttpError('This purchase order no longer exists.', 404);
    const allowed: Record<string, string[]> = {
        draft: ['rfq', 'ordered', 'cancelled'],
        rfq: ['draft', 'ordered', 'cancelled'],
        ordered: ['cancelled'],
        partial: ['received'],
        received: [],
        cancelled: ['draft'],
    };
    if (!allowed[po.status]?.includes(body.status)) throw new HttpError(`A ${po.status} purchase order cannot become ${body.status}.`, 409);
    if (body.status === 'cancelled') {
        const pending = must(await supabase.from('purchase_receipts').select('id').eq('purchase_order_id', body.id).eq('status', 'pending').is('deleted_at', null));
        if (pending.length) throw new HttpError('Validate or cancel its pending receipts first.', 409);
    }
    const data = must(await supabase.from('purchase_orders').update({ status: body.status }).eq('id', body.id).select().single());
    invalidateCatalog();
    return ok(data);
});

// DELETE ?id= — only drafts and price requests nothing was received on.
export const DELETE = route('purchasing-orders', async (request) => {
    const id = params(request).get('id');
    if (!id) throw new HttpError('Missing id');
    const po = must(await supabase.from('purchase_orders').select('status').eq('id', id).is('deleted_at', null).maybeSingle());
    if (!po) throw new HttpError('This purchase order no longer exists.', 404);
    if (!['draft', 'rfq', 'cancelled'].includes(po.status)) throw new HttpError('Cancel the purchase order instead: goods may have been received.', 409);
    must(await supabase.from('purchase_orders').update({ deleted_at: new Date().toISOString() }).eq('id', id));
    return ok({ id });
});
