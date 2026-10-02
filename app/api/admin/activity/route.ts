import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Back-office history (Admin → Activity). Middleware limits this route to admins.
// GET ?actor=&entity=&action=&from=&to=&page=&pageSize= returns { rows, total, actors }.

const MAX_PAGE_SIZE = 200;

export async function GET(request: NextRequest) {
    try {
        const params = request.nextUrl.searchParams;
        const page = Math.max(1, Number(params.get('page')) || 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(params.get('pageSize')) || 50));

        let query = supabase
            .from('activity_log')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * pageSize, page * pageSize - 1);

        const actor = params.get('actor');
        if (actor === 'database') query = query.eq('source', 'database');
        else if (actor) query = query.eq('actor_id', actor);
        const entity = params.get('entity');
        if (entity) query = query.eq('entity', entity);
        const action = params.get('action');
        if (action) query = query.eq('action', action);
        const entityId = params.get('entityId');
        if (entityId) query = query.eq('entity_id', entityId);
        const from = params.get('from');
        if (from) query = query.gte('created_at', from);
        const to = params.get('to');
        if (to) query = query.lte('created_at', to);

        const [result, actorsResult] = await Promise.all([query, supabase.rpc('activity_actors')]);
        if (result.error) throw result.error;
        if (actorsResult.error) throw actorsResult.error;

        return NextResponse.json({
            success: true,
            data: { rows: result.data ?? [], total: result.count ?? 0, actors: actorsResult.data ?? [] },
        });
    } catch (error) {
        console.error('Error fetching activity log:', error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
