import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, ok, params, readBody, route, zId } from '@/lib/erp/api';
import { MATERIAL_UNITS } from '@/lib/erp/constants';

export const dynamic = 'force-dynamic';

/** Raw materials (fabric, thread, buttons...): stock, average cost, and their movement history. */

// GET ?id= (with movements and purchase history) or the list.
export const GET = route('purchasing-materials', async (request) => {
    const q = params(request);
    const id = q.get('id');
    if (id) {
        const [material, movements, purchases] = await Promise.all([
            supabase.from('raw_materials').select('*, supplier:suppliers(id, name)').eq('id', id).is('deleted_at', null).maybeSingle(),
            supabase.from('material_movements').select('*').eq('material_id', id).order('created_at', { ascending: false }).limit(300),
            supabase.from('purchase_order_lines')
                .select('quantity, unit_cost, received_quantity, purchase_order:purchase_orders!inner(id, number, order_date, status, deleted_at, supplier:suppliers(name))')
                .eq('material_id', id).is('deleted_at', null).is('purchase_order.deleted_at', null)
                .order('created_at', { ascending: false }).limit(100),
        ]);
        const row = must(material);
        if (!row) throw new HttpError('This raw material no longer exists.', 404);
        return ok({ ...row, movements: must(movements), purchases: must(purchases) });
    }
    return ok(must(await supabase.from('raw_materials').select('*, supplier:suppliers(id, name)').is('deleted_at', null).order('name')));
});

const fields = {
    name: z.string().trim().min(1).max(150),
    code: z.string().trim().max(50).nullable(),
    unit: z.enum(MATERIAL_UNITS),
    supplier_id: zId.nullable(),
    reorder_point: z.number().min(0).max(1_000_000),
    notes: z.string().trim().max(2000).nullable(),
};

export const POST = route('purchasing-materials', async (request) => {
    const body = await readBody(request, z.object(fields).partial().required({ name: true }));
    return ok(must(await supabase.from('raw_materials').insert({ ...body, code: body.code || null }).select().single()), 201);
});

export const PUT = route('purchasing-materials', async (request) => {
    const body = await readBody(request, z.object({ id: zId, ...fields }).partial().required({ id: true }));
    const { id, ...row } = body;
    return ok(must(await supabase.from('raw_materials').update(row).eq('id', id).is('deleted_at', null).select().single()));
});

// PATCH — a stock movement: { id, type, quantity, unit_cost?, note }. `purchase` is for stock
// bought outside a purchase order (or the opening stock) and moves the average cost; orders go
// through goods receipts, and production consumes automatically.
export const PATCH = route('purchasing-materials', async (request, actor) => {
    const body = await readBody(request, z.object({
        id: zId,
        type: z.enum(['purchase', 'adjustment', 'consumption', 'return']),
        quantity: z.number().finite().refine((v) => v !== 0, 'Quantity cannot be zero'),
        unit_cost: z.number().min(0).max(1_000_000).optional(),
        note: z.string().trim().max(500).default(''),
    }));
    const quantity = body.type === 'consumption' ? -Math.abs(body.quantity) : body.type === 'adjustment' ? body.quantity : Math.abs(body.quantity);
    must(await supabase.from('material_movements').insert({
        material_id: body.id, type: body.type, quantity, note: body.note,
        unit_cost: body.type === 'purchase' ? body.unit_cost ?? null : null,
        reference: body.type === 'adjustment' ? 'Count' : '',
        created_by: actor.userId, created_by_email: actor.email,
    }));
    return ok(must(await supabase.from('raw_materials').select('*').eq('id', body.id).single()));
});

export const DELETE = route('purchasing-materials', async (request) => {
    const id = params(request).get('id');
    if (!id) throw new HttpError('Missing id');
    const used = must(await supabase.from('product_bom').select('id').eq('material_id', id).is('deleted_at', null).limit(1));
    if (used.length) throw new HttpError('This material is in a bill of materials. Remove it there first.', 409);
    must(await supabase.from('raw_materials').update({ deleted_at: new Date().toISOString() }).eq('id', id));
    return ok({ id });
});
