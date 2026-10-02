import { NextRequest } from 'next/server';
import supabase from '@/lib/supabase-admin';
import { stockLookupHandlers } from '@/lib/stock-crud';

export const dynamic = 'force-dynamic';

// A deleted location would hide its stock, so only empty, offline locations can be deleted.
async function canDeleteLocation(id: string): Promise<string | null> {
    const [{ data: location }, { count }] = await Promise.all([
        supabase.from('locations').select('sells_online').eq('id', id).maybeSingle(),
        supabase.from('inventory_levels').select('variant_id', { count: 'exact', head: true }).eq('location_id', id).gt('available', 0),
    ]);
    if (location?.sells_online) return 'This location sells online. Make another location the online one first.';
    if (count) return 'This location still holds stock. Transfer it to another location first.';
    return null;
}

const handlers = stockLookupHandlers('locations', ['name', 'sells_online'], 'Location', canDeleteLocation);

export const { GET, DELETE } = handlers;

// Only one location can sell online: making one online clears the flag on the others first.
async function clearOnlineFlag(request: NextRequest) {
    const body = await request.clone().json();
    if (body.sells_online === true) {
        let query = supabase.from('locations').update({ sells_online: false }).eq('sells_online', true);
        if (body.id) query = query.neq('id', body.id);
        await query;
    }
}

export async function POST(request: NextRequest) {
    await clearOnlineFlag(request);
    return handlers.POST(request);
}

export async function PUT(request: NextRequest) {
    await clearOnlineFlag(request);
    return handlers.PUT(request);
}
