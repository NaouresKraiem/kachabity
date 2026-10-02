import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { getAdminActor } from '@/lib/admin-auth';
import { invalidateCatalog } from '@/lib/catalog-cache';
import { MOVEMENT_TYPES, stockErrorMessage, type MovementType } from '@/lib/stock';

export const dynamic = 'force-dynamic';

// GET - Movement history, newest first. Filters: type, location_id, variant_id, product_id, search (sku/product/reference).
export async function GET(request: NextRequest) {
    try {
        const sp = request.nextUrl.searchParams;
        const limit = Math.min(Math.max(Number(sp.get('limit')) || 50, 1), 500);
        const offset = Math.max(Number(sp.get('offset')) || 0, 0);

        let query = supabase
            .from('stock_movements')
            .select('id, type, quantity, sku, product_name, reference, note, created_at, created_by_email, order_id, variant_id, location_id, locations(name), product_variants(product_id, colors(name, display_name), sizes(name))', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const type = sp.get('type');
        if (type && MOVEMENT_TYPES.includes(type as MovementType)) query = query.eq('type', type);
        const location = sp.get('location_id');
        if (location) query = query.eq('location_id', location);
        const variant = sp.get('variant_id');
        if (variant) query = query.eq('variant_id', variant);
        const search = sp.get('search')?.trim().replace(/[%,()]/g, '');
        if (search) query = query.or(`sku.ilike.%${search}%,product_name.ilike.%${search}%,reference.ilike.%${search}%`);

        const { data, error, count } = await query;
        if (error) throw error;
        return NextResponse.json({ success: true, data: data ?? [], total: count ?? 0 });
    } catch (error) {
        console.error('Movements GET error:', error);
        return NextResponse.json({ success: false, error: 'Unable to load stock movements' }, { status: 500 });
    }
}

const itemSchema = z.object({
    variant_id: z.guid(),
    quantity: z.number().int(),
    // Optional per-item location (counting several locations at once).
    location_id: z.guid().optional(),
});

const movementSchema = z.object({
    // 'count' sets the counted quantity and records the difference as adjustments.
    type: z.enum(['sale', 'restock', 'adjustment', 'return', 'transfer', 'count']),
    location_id: z.guid(),
    to_location_id: z.guid().optional(),
    items: z.array(itemSchema).min(1).max(500),
    reference: z.string().max(200).optional(),
    note: z.string().max(1000).optional(),
    // Also start tracking these products' stock on the website.
    track: z.boolean().optional(),
});

// POST - Record movements. Everything in one request runs in one transaction
// (record_stock_movements): a shortage on any line rejects them all.
export async function POST(request: NextRequest) {
    try {
        const parsed = movementSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: 'Invalid movement data' }, { status: 400 });
        }
        const body = parsed.data;
        if (body.type === 'transfer' && (!body.to_location_id || body.to_location_id === body.location_id)) {
            return NextResponse.json({ success: false, error: 'Choose a different destination location.' }, { status: 400 });
        }
        if (body.type === 'count' && body.items.some((i) => i.quantity < 0)) {
            return NextResponse.json({ success: false, error: 'Counted quantities cannot be negative.' }, { status: 400 });
        }

        const actor = getAdminActor(request.headers);
        const { data: recorded, error } = await supabase.rpc('record_stock_movements', {
            p_type: body.type,
            p_location_id: body.location_id,
            p_items: body.items,
            p_to_location_id: body.to_location_id ?? null,
            p_reference: body.reference?.trim() ?? '',
            p_note: body.note?.trim() ?? '',
            p_track: body.track ?? false,
            p_actor: actor.userId,
            p_actor_email: actor.email,
        });
        if (error) {
            return NextResponse.json({ success: false, error: stockErrorMessage(error) }, { status: 409 });
        }

        invalidateCatalog(); // the shop's stock display may have changed
        return NextResponse.json({ success: true, data: { recorded } });
    } catch (error) {
        console.error('Movements POST error:', error);
        return NextResponse.json({ success: false, error: stockErrorMessage(error as { message?: string }) }, { status: 500 });
    }
}
