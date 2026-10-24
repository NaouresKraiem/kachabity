import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase-admin';
import { reportError } from '@/lib/report-error';
import { analyticsStart } from '@/lib/erp/goals';
import { clampToStart } from '@/lib/erp/objectives';

// GET ?from=&to= (ISO dates; default: last 30 days) — orders added per agent and how they ended
// (Admin → Agent performance, owners and admins only). Website orders come back with agent_id null.
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;
        const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : new Date();
        const asked = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(to.getTime() - 30 * 86_400_000);
        if (Number.isNaN(asked.getTime()) || Number.isNaN(to.getTime()) || asked >= to) {
            return NextResponse.json({ success: false, error: 'Invalid period' }, { status: 400 });
        }
        // Counted from the analytics start date (Business settings).
        const start = clampToStart(asked, await analyticsStart());
        const from = start < to ? start : to;
        const { data, error } = await supabase.rpc('agent_performance', { p_from: from.toISOString(), p_to: to.toISOString() });
        if (error) throw error;
        return NextResponse.json({ success: true, data: { from: from.toISOString(), to: to.toISOString(), rows: data ?? [] } });
    } catch (error) {
        console.error('Error loading agent performance:', error);
        reportError(error, 'admin-performance');
        return NextResponse.json({ success: false, error: 'Unable to load agent performance' }, { status: 500 });
    }
}
