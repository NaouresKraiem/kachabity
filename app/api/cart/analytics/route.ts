import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resilientFetch } from '@/lib/resilient-fetch';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Supabase is not configured');
    }

    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: resilientFetch } });
}

export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabaseClient();
        const type = request.nextUrl.searchParams.get('type');

        if (type === 'abandoned') {
            const requestedLimit = Number(request.nextUrl.searchParams.get('limit') || 20);
            const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100) : 20;
            const { data, error } = await supabase
                .from('abandoned_carts')
                .select('*')
                .order('last_activity_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return NextResponse.json({ success: true, data: data ?? [] });
        }

        const requestedDays = Number(request.nextUrl.searchParams.get('days') || 30);
        const days = Number.isFinite(requestedDays) ? Math.min(Math.max(Math.trunc(requestedDays), 1), 365) : 30;
        const { data, error } = await supabase
            .from('cart_analytics')
            .select('*')
            .order('date', { ascending: false })
            .limit(days);

        if (error) throw error;
        return NextResponse.json({ success: true, data: data ?? [] });
    } catch (error) {
        console.error('Cart analytics error:', error);
        return NextResponse.json(
            { success: false, data: [], error: 'Unable to load cart analytics' },
            { status: 500 }
        );
    }
}
