import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase-admin';
import { getAdminActor } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// The signed-in back-office user's own notifications (new orders, owner alerts).
// Rows are created by the database (private.notify); the admin bell also receives them live.

// GET ?limit=&before=<id>&kind=&unread=1 returns { rows, unread, hasMore }.
export async function GET(request: NextRequest) {
    try {
        const { userId } = getAdminActor(request.headers);
        if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        const params = request.nextUrl.searchParams;
        const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 20));

        let query = supabase
            .from('notifications')
            .select('id, created_at, kind, type, severity, title, body, url, data, read_at')
            .eq('recipient_id', userId)
            .is('deleted_at', null)
            .order('id', { ascending: false })
            .limit(limit + 1);
        const before = Number(params.get('before'));
        if (before) query = query.lt('id', before);
        const kind = params.get('kind');
        if (kind) query = query.eq('kind', kind);
        if (params.get('unread') === '1') query = query.is('read_at', null);

        const [rowsResult, unreadResult] = await Promise.all([
            query,
            supabase.from('notifications').select('id', { count: 'exact', head: true })
                .eq('recipient_id', userId).is('deleted_at', null).is('read_at', null),
        ]);
        if (rowsResult.error) throw rowsResult.error;
        if (unreadResult.error) throw unreadResult.error;

        const rows = rowsResult.data ?? [];
        return NextResponse.json({
            success: true,
            data: { rows: rows.slice(0, limit), hasMore: rows.length > limit, unread: unreadResult.count ?? 0 },
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}

// PUT { ids: number[] } or { all: true } marks the user's notifications read.
export async function PUT(request: NextRequest) {
    try {
        const { userId } = getAdminActor(request.headers);
        if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        const body = await request.json();
        let query = supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('recipient_id', userId)
            .is('read_at', null);
        if (body.all !== true) {
            const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isInteger) : [];
            if (ids.length === 0) return NextResponse.json({ success: false, error: 'ids or all is required' }, { status: 400 });
            query = query.in('id', ids);
        }
        const { error } = await query;
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error marking notifications read:', error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
