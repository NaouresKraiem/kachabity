import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase-admin';
import { getAdminActor } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const PAGE = 1000;

// GET - Dashboard figures: units on hand, low/out counts (tracked products, online location),
// 30-day movement series and the latest movements. Stock value at cost needs the `costs` permission.
export async function GET(request: NextRequest) {
    try {
        const actor = getAdminActor(request.headers);

        type Level = { location_id: string; available: number; product_variants: { reorder_point: number; product_id: string; products: { stock_tracked: boolean; deleted_at: string | null } | null } | null };
        const loadLevels = async () => {
            const levels: Level[] = [];
            for (let from = 0; ; from += PAGE) {
                const { data, error } = await supabase
                    .from('inventory_levels')
                    .select('location_id, available, product_variants!inner(reorder_point, product_id, deleted_at, products!inner(stock_tracked, deleted_at))')
                    .is('product_variants.deleted_at', null)
                    .is('product_variants.products.deleted_at', null)
                    .order('variant_id')
                    .order('location_id')
                    .range(from, from + PAGE - 1);
                if (error) throw error;
                levels.push(...((data ?? []) as unknown as Level[]));
                if (!data || data.length < PAGE) break;
            }
            return levels;
        };

        // Tracked variants that have never had a movement have no inventory row yet: they count as out of stock.
        const uncountedQuery = supabase
            .from('product_variants')
            .select('id, products!inner(stock_tracked, deleted_at), inventory_levels!left(location_id)', { count: 'exact', head: true })
            .is('deleted_at', null)
            .eq('products.stock_tracked', true)
            .is('products.deleted_at', null)
            .is('inventory_levels', null);
        const costsQuery = actor.permissions.includes('costs')
            ? supabase.from('product_costs').select('product_id, cost').is('deleted_at', null)
            : Promise.resolve({ data: null, error: null });

        // Everything is independent, so it all goes out at once.
        const [locationsResult, statsResult, recentResult, untrackedResult, levels, uncountedResult, costsResult] = await Promise.all([
            supabase.from('locations').select('id, name, sells_online').is('deleted_at', null),
            supabase.from('daily_movement_stats').select('*'),
            supabase
                .from('stock_movements')
                .select('id, type, quantity, sku, product_name, reference, created_at, created_by_email, locations(name)')
                .order('created_at', { ascending: false })
                .limit(8),
            supabase.from('products').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('stock_tracked', false),
            loadLevels(),
            uncountedQuery,
            costsQuery,
        ]);
        if (locationsResult.error) throw locationsResult.error;
        if (statsResult.error) throw statsResult.error;
        if (recentResult.error) throw recentResult.error;

        const onlineId = (locationsResult.data ?? []).find((l: { sells_online: boolean }) => l.sells_online)?.id ?? null;

        let units = 0;
        let lowStock = 0;
        let outOfStock = 0;
        const unitsByProduct = new Map<string, number>();
        for (const level of levels) {
            const variant = level.product_variants;
            if (!variant) continue;
            units += level.available;
            unitsByProduct.set(variant.product_id, (unitsByProduct.get(variant.product_id) ?? 0) + level.available);
            if (level.location_id !== onlineId || !variant.products?.stock_tracked) continue;
            if (level.available <= 0) outOfStock += 1;
            else if (level.available <= variant.reorder_point) lowStock += 1;
        }

        if (onlineId) outOfStock += uncountedResult.count ?? 0;

        let stockValue: number | null = null;
        if (costsResult.error) throw costsResult.error;
        if (costsResult.data) {
            stockValue = (costsResult.data as { product_id: string; cost: number }[]).reduce((sum, c) => sum + Number(c.cost) * (unitsByProduct.get(c.product_id) ?? 0), 0);
        }

        return NextResponse.json({
            success: true,
            data: {
                units,
                low_stock: lowStock,
                out_of_stock: outOfStock,
                untracked_products: untrackedResult.count ?? 0,
                stock_value: stockValue,
                daily: statsResult.data ?? [],
                recent: recentResult.data ?? [],
            },
        });
    } catch (error) {
        console.error('Stock overview error:', error);
        return NextResponse.json({ success: false, error: 'Unable to load stock overview' }, { status: 500 });
    }
}
