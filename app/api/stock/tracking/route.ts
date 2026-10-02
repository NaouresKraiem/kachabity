import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase-admin';
import { invalidateCatalog } from '@/lib/catalog-cache';

export const dynamic = 'force-dynamic';

// PUT { product_ids, tracked } switches stock tracking for products. When switched on, the
// database copies the online location's counts into product_variants.stock, so the shop
// starts showing real availability.
export async function PUT(request: NextRequest) {
    const { product_ids, tracked } = await request.json();
    if (!Array.isArray(product_ids) || product_ids.length === 0 || typeof tracked !== 'boolean') {
        return NextResponse.json({ success: false, error: 'product_ids and tracked are required' }, { status: 400 });
    }
    const { error } = await supabase.from('products').update({ stock_tracked: tracked }).in('id', product_ids);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    invalidateCatalog();
    return NextResponse.json({ success: true });
}
