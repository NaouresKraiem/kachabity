import { NextRequest } from 'next/server';
import supabase from '@/lib/supabase-admin';
import { stockLookupHandlers } from '@/lib/stock-crud';

export const dynamic = 'force-dynamic';

const handlers = stockLookupHandlers('locations', ['name', 'sells_online'], 'Location');

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
