import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { must, ok, params, readBody, route, zId } from '@/lib/erp/api';
import { invalidateCatalog } from '@/lib/catalog-cache';

export const dynamic = 'force-dynamic';

/**
 * Cost price per model: bill of materials (materials per unit), labor and overhead. Without a
 * bill of materials the cost price is the stock's average cost (or the purchase cost entered).
 * POST records a production run: materials are consumed and the units enter stock at cost price.
 */

// GET — cost price of every product; ?product_id= adds its bill of materials and costing.
export const GET = route('purchasing-costing', async (request) => {
    const productId = params(request).get('product_id');
    if (productId) {
        const [bom, costing] = await Promise.all([
            supabase.from('product_bom').select('id, material_id, quantity, material:raw_materials(name, unit, avg_cost, stock)').eq('product_id', productId).is('deleted_at', null),
            supabase.from('product_costing').select('*').eq('product_id', productId).is('deleted_at', null).maybeSingle(),
        ]);
        return ok({ bom: must(bom), costing: must(costing) });
    }
    return ok(must(await supabase.rpc('product_cost_prices')));
});

const saveSchema = z.object({
    product_id: zId,
    labor_cost: z.number().min(0).max(1_000_000).default(0),
    overhead_cost: z.number().min(0).max(1_000_000).default(0),
    notes: z.string().trim().max(2000).optional(),
    bom: z.array(z.object({ material_id: zId, quantity: z.number().positive().max(1_000_000) })).max(100),
});

// PUT — saves a product's bill of materials, labor and overhead together.
export const PUT = route('purchasing-costing', async (request) => {
    const body = await readBody(request, saveSchema);
    must(await supabase.rpc('save_product_costing', {
        p_product_id: body.product_id,
        p_labor: body.labor_cost,
        p_overhead: body.overhead_cost,
        p_notes: body.notes ?? '',
        p_bom: body.bom,
    }));
    return ok({ product_id: body.product_id });
});

const productionSchema = z.object({
    variant_id: zId,
    quantity: z.number().int().min(1).max(100_000),
    location_id: zId,
    note: z.string().trim().max(500).default(''),
});

// POST — a production run.
export const POST = route('purchasing-costing', async (request, actor) => {
    const body = await readBody(request, productionSchema);
    const data = must(await supabase.rpc('record_production', {
        p_variant_id: body.variant_id,
        p_quantity: body.quantity,
        p_location_id: body.location_id,
        p_note: body.note,
        p_actor: actor.userId,
        p_actor_email: actor.email,
    }));
    invalidateCatalog();
    return ok(data, 201);
});
