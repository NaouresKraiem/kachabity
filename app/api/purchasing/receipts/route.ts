import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, ok, params, readBody, route, zDate, zId } from '@/lib/erp/api';
import { invalidateCatalog } from '@/lib/catalog-cache';

export const dynamic = 'force-dynamic';

/**
 * Goods received against a purchase order. Each line is checked: accepted units enter stock (at
 * the order's unit cost) when the receipt is validated; rejected units don't.
 */

// GET ?purchase_order_id= | recent receipts
export const GET = route('purchasing-receipts', async (request) => {
    const q = params(request);
    let query = supabase.from('purchase_receipts')
        .select('*, purchase_order:purchase_orders(number, supplier:suppliers(name)), lines:purchase_receipt_lines(*)')
        .is('deleted_at', null);
    if (q.get('purchase_order_id')) query = query.eq('purchase_order_id', q.get('purchase_order_id')!);
    if (q.get('status')) query = query.eq('status', q.get('status')!);
    return ok(must(await query.order('created_at', { ascending: false }).limit(q.int('limit', 200, 1000))));
});

const createSchema = z.object({
    purchase_order_id: zId,
    received_on: zDate.optional(),
    location_id: zId.nullish(),
    notes: z.string().trim().max(2000).optional(),
    lines: z.array(z.object({
        po_line_id: zId,
        quantity_accepted: z.number().min(0).max(1_000_000),
        quantity_rejected: z.number().min(0).max(1_000_000).default(0),
        reject_reason: z.string().trim().max(250).optional(),
    })).min(1).max(300),
    // Validate now (stock goes up) or leave it pending until the goods are checked.
    validate: z.boolean().default(false),
});

export const POST = route('purchasing-receipts', async (request, actor) => {
    const body = await readBody(request, createSchema);
    const data = must(await supabase.rpc('create_purchase_receipt', {
        p_po_id: body.purchase_order_id,
        p_receipt: { received_on: body.received_on ?? '', location_id: body.location_id ?? '', notes: body.notes ?? '' },
        p_lines: body.lines,
        p_validate: body.validate,
        p_actor: actor.userId,
        p_actor_email: actor.email,
    }));
    if (body.validate) invalidateCatalog();
    return ok(data, 201);
});

// PUT { id, action: validate | cancel }
export const PUT = route('purchasing-receipts', async (request, actor) => {
    const body = await readBody(request, z.object({ id: zId, action: z.enum(['validate', 'cancel']) }));
    if (body.action === 'validate') {
        const data = must(await supabase.rpc('validate_purchase_receipt', { p_receipt_id: body.id, p_actor: actor.userId, p_actor_email: actor.email }));
        invalidateCatalog();
        return ok(data);
    }
    const receipt = must(await supabase.from('purchase_receipts').select('status').eq('id', body.id).is('deleted_at', null).maybeSingle());
    if (!receipt) throw new HttpError('This receipt no longer exists.', 404);
    if (receipt.status !== 'pending') throw new HttpError('Only receipts waiting for their check can be cancelled.', 409);
    return ok(must(await supabase.from('purchase_receipts').update({ status: 'cancelled' }).eq('id', body.id).select().single()));
});
