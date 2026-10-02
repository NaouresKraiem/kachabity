import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor } from '@/lib/admin-auth';
import { invalidateCatalog } from '@/lib/catalog-cache';
import supabase from '@/lib/supabase-admin';
import { TRASH_TABLES, isTrashTable, type TrashTable } from '@/lib/trash-tables';

export const dynamic = 'force-dynamic';

// Deleted items (Admin → Deleted items). Middleware requires `hard_delete`, plus the area's
// permission when ?table= is given.
// GET            → { counts: { [table]: n } } for the areas the caller can edit
// GET ?table=    → { rows: [{ id, label, deleted_at }] } (newest first)
// DELETE ?table=&ids=a,b → erases those soft-deleted rows for good

const MAX_ROWS = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown> & { id: string; deleted_at: string };

function labelOf(row: Row): string {
    const text = (key: string) => (typeof row[key] === 'string' && row[key] ? (row[key] as string) : null);
    if (row.discount_percent != null) {
        const product = (row.products as { name?: string } | null)?.name;
        return `${row.discount_percent}%${product ? ` · ${product}` : ''}`;
    }
    const main = text('order_number') ?? text('display_name') ?? text('name') ?? text('title') ?? text('sku') ?? row.id;
    const extra = text('customer_email') ?? text('code');
    return extra ? `${main} · ${extra}` : main;
}

const failure = (error: unknown, status = 500) =>
    NextResponse.json({ success: false, error: (error as Error)?.message ?? String(error) }, { status });

export async function GET(request: NextRequest) {
    try {
        const table = request.nextUrl.searchParams.get('table');

        if (table === null) {
            const actor = getAdminActor(request.headers);
            const tables = (Object.keys(TRASH_TABLES) as TrashTable[]).filter((t) =>
                actor.role === 'admin' || actor.permissions.includes(TRASH_TABLES[t].permission));
            const results = await Promise.all(tables.map((t) =>
                supabase.from(t).select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null)));
            const failed = results.find((r) => r.error);
            if (failed?.error) throw failed.error;
            const counts = Object.fromEntries(tables.map((t, i) => [t, results[i].count ?? 0]));
            return NextResponse.json({ success: true, data: { counts } });
        }

        if (!isTrashTable(table)) return failure(new Error('Unknown table'), 400);
        const { data, error } = await supabase
            .from(table)
            .select(TRASH_TABLES[table].columns)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false })
            .limit(MAX_ROWS);
        if (error) throw error;
        const rows = ((data ?? []) as unknown as Row[]).map((row) => ({ id: row.id, label: labelOf(row), deleted_at: row.deleted_at }));
        return NextResponse.json({ success: true, data: { rows } });
    } catch (error) {
        console.error('Error loading deleted items:', error);
        return failure(error);
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const params = request.nextUrl.searchParams;
        const table = params.get('table');
        if (!isTrashTable(table)) return failure(new Error('Unknown table'), 400);
        const ids = (params.get('ids') ?? '').split(',').map((id) => id.trim()).filter(Boolean);
        if (ids.length === 0 || !ids.every((id) => UUID.test(id))) return failure(new Error('ids must be a comma-separated list of ids'), 400);

        const { data, error } = await supabase.rpc('purge_deleted', { p_table: table, p_ids: ids });
        if (error) {
            // A row the database still needs elsewhere (a location with stock movements).
            if (error.code === '23503') {
                return NextResponse.json(
                    { success: false, code: 'IN_USE', error: 'Some of these are still used by other records, so nothing was erased.' },
                    { status: 409 },
                );
            }
            // Stock only changes through movements, so it has to be brought to 0 first.
            if (error.message?.startsWith('has_stock')) {
                return NextResponse.json(
                    { success: false, code: 'HAS_STOCK', error: 'Some of these still hold stock. Record a movement to bring it to 0 first.' },
                    { status: 409 },
                );
            }
            throw error;
        }

        invalidateCatalog();
        return NextResponse.json({ success: true, data: { erased: data ?? 0 } });
    } catch (error) {
        console.error('Error erasing deleted items:', error);
        return failure(error);
    }
}
