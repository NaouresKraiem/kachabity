import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase-admin';
import { invalidateCatalog } from '@/lib/catalog-cache';
import { stockErrorMessage } from '@/lib/stock';

/**
 * GET/POST/PUT/DELETE handlers for the small stock lookup tables (locations, suppliers, collections).
 * `fields` whitelists the writable columns; middleware restricts DELETE to admins.
 */
export function stockLookupHandlers(table: string, fields: string[], label: string) {
    const pick = (body: Record<string, unknown>) => {
        const row: Record<string, unknown> = {};
        for (const field of fields) {
            if (!(field in body)) continue;
            const value = body[field];
            row[field] = typeof value === 'string' ? value.trim() || null : value;
        }
        return row;
    };

    const fail = (error: { message?: string; code?: string }, status = 400) =>
        NextResponse.json({ success: false, error: stockErrorMessage(error) }, { status });

    return {
        async GET() {
            const { data, error } = await supabase.from(table).select('*').order('name');
            if (error) return fail(error, 500);
            return NextResponse.json({ success: true, data: data ?? [] });
        },

        async POST(request: NextRequest) {
            const row = pick(await request.json());
            if (!row.name) return NextResponse.json({ success: false, error: `${label} name is required` }, { status: 400 });
            const { data, error } = await supabase.from(table).insert(row).select().single();
            if (error) return fail(error);
            invalidateCatalog();
            return NextResponse.json({ success: true, data });
        },

        async PUT(request: NextRequest) {
            const body = await request.json();
            if (!body.id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
            const row = pick(body);
            if ('name' in row && !row.name) return NextResponse.json({ success: false, error: `${label} name is required` }, { status: 400 });
            const { data, error } = await supabase.from(table).update(row).eq('id', body.id).select().single();
            if (error) return fail(error);
            invalidateCatalog();
            return NextResponse.json({ success: true, data });
        },

        async DELETE(request: NextRequest) {
            const id = request.nextUrl.searchParams.get('id');
            if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) return fail(error);
            invalidateCatalog();
            return NextResponse.json({ success: true });
        },
    };
}
