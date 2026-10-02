import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase-admin';
import { stockStatus } from '@/lib/stock';

export const dynamic = 'force-dynamic';

const PAGE = 1000;

interface VariantRow {
    id: string;
    sku: string | null;
    reorder_point: number;
    is_available: boolean;
    product_id: string;
    colors: { name: string; display_name: string | null; hex_code: string | null } | null;
    sizes: { name: string; sort_order: number } | null;
    inventory_levels: { location_id: string; available: number }[];
    product_images: { image_url: string; is_main: boolean; position: number }[];
    products: {
        id: string; name: string; name_ar: string | null; code: string | null; status: string; stock_tracked: boolean;
        deleted_at: string | null; category_id: string | null; supplier_id: string | null;
        categories: { name: string } | null; suppliers: { name: string } | null;
        product_images: { image_url: string; is_main: boolean; position: number; variant_id: string | null }[];
    } | null;
}

// GET - One row per variant with stock per location, totals and status.
export async function GET() {
    try {
        const locationsResult = await supabase.from('locations').select('id, name, sells_online').order('sells_online', { ascending: false }).order('name');
        if (locationsResult.error) throw locationsResult.error;

        // Page through variants: PostgREST caps responses at 1000 rows.
        const variants: VariantRow[] = [];
        for (let from = 0; ; from += PAGE) {
            const { data, error } = await supabase
                .from('product_variants')
                .select(`id, sku, reorder_point, is_available, product_id,
                    colors(name, display_name, hex_code), sizes(name, sort_order),
                    inventory_levels(location_id, available),
                    product_images(image_url, is_main, position),
                    products!inner(id, name, name_ar, code, status, stock_tracked, deleted_at, category_id, supplier_id,
                        categories(name), suppliers(name),
                        product_images(image_url, is_main, position, variant_id))`)
                .is('deleted_at', null)
                .is('products.deleted_at', null)
                .is('products.product_images.variant_id', null)
                .order('id')
                .range(from, from + PAGE - 1);
            if (error) throw error;
            variants.push(...((data ?? []) as unknown as VariantRow[]));
            if (!data || data.length < PAGE) break;
        }

        const locations = locationsResult.data ?? [];
        const onlineId = locations.find((l: { sells_online: boolean }) => l.sells_online)?.id ?? null;

        const rows = variants.map((v) => {
            const p = v.products!;
            const levels: Record<string, number> = {};
            for (const l of v.inventory_levels ?? []) levels[l.location_id] = l.available;
            const total = Object.values(levels).reduce((sum, n) => sum + n, 0);
            const online = onlineId ? levels[onlineId] ?? 0 : 0;
            const byMain = (a: { is_main: boolean; position: number }, b: { is_main: boolean; position: number }) => Number(b.is_main) - Number(a.is_main) || a.position - b.position;
            const productImage = [...(p.product_images ?? [])].sort(byMain)[0]?.image_url ?? null;
            // The variant's own photo when it has one (e.g. per color), otherwise the product's.
            const variantImage = [...(v.product_images ?? [])].sort(byMain)[0]?.image_url ?? null;
            return {
                variant_id: v.id,
                sku: v.sku,
                reorder_point: v.reorder_point,
                color: v.colors ? v.colors.display_name || v.colors.name : null,
                color_hex: v.colors?.hex_code ?? null,
                size: v.sizes?.name ?? null,
                size_order: v.sizes?.sort_order ?? 0,
                product_id: p.id,
                product_name: p.name,
                product_name_ar: p.name_ar,
                product_code: p.code,
                product_status: p.status,
                category: p.categories?.name ?? null,
                category_id: p.category_id,
                supplier: p.suppliers?.name ?? null,
                supplier_id: p.supplier_id,
                stock_tracked: p.stock_tracked,
                image: variantImage ?? productImage,
                product_image: productImage,
                levels,
                total,
                online,
                // Status follows what the online shop can sell.
                status: stockStatus(online, v.reorder_point, p.stock_tracked),
            };
        });
        rows.sort((a, b) => a.product_name.localeCompare(b.product_name) || (a.color ?? '').localeCompare(b.color ?? '') || a.size_order - b.size_order);

        return NextResponse.json({ success: true, data: { locations, rows } });
    } catch (error) {
        console.error('Inventory error:', error);
        return NextResponse.json({ success: false, error: 'Unable to load inventory' }, { status: 500 });
    }
}
