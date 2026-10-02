import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Purchase costs per product. Middleware limits this route to admins.

export async function GET() {
    const { data, error } = await supabase.from('product_costs').select('product_id, cost, updated_at');
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: data ?? [] });
}

// PUT { product_id, cost } sets the cost; a null cost removes it.
export async function PUT(request: NextRequest) {
    const { product_id, cost } = await request.json();
    if (!product_id) return NextResponse.json({ success: false, error: 'Missing product_id' }, { status: 400 });

    if (cost === null || cost === undefined || cost === '') {
        const { error } = await supabase.from('product_costs').delete().eq('product_id', product_id);
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        return NextResponse.json({ success: true, data: null });
    }

    const value = Number(cost);
    if (!Number.isFinite(value) || value < 0) {
        return NextResponse.json({ success: false, error: 'Cost must be zero or more' }, { status: 400 });
    }
    const { data, error } = await supabase
        .from('product_costs')
        .upsert({ product_id, cost: value }, { onConflict: 'product_id' })
        .select()
        .single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, data });
}
