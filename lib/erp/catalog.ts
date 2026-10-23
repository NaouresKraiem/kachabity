import supabase from '@/lib/supabase-admin';
import { getActiveProductDiscounts } from '@/lib/product-discounts';
import { must } from '@/lib/erp/api';

export interface SellableVariant {
    product_id: string;
    variant_id: string | null;
    name: string;
    label: string;
    sku: string | null;
    code: string | null;
    price: number;           // what the customer pays (discount applied), like the shop
    base_price: number;
    discount_percent: number;
    image: string | null;
    tracked: boolean;
    stock: number | null;    // units at the location (tracked products), null otherwise
}

/**
 * Every live product variant with its selling price (the storefront's rule:
 * round(variant or base price × (1 − active discount%))) and its stock at one location.
 * Used by the till.
 */
export async function listSellable(locationId: string | null): Promise<SellableVariant[]> {
    const [products, variants, levels] = await Promise.all([
        supabase.from('products')
            .select('id, name, code, base_price, stock_tracked, product_images(image_url, is_main, position, variant_id, deleted_at)')
            .is('deleted_at', null).eq('status', 'active'),
        supabase.from('product_variants')
            .select('id, product_id, sku, price, colors(name, display_name), sizes(name)')
            .is('deleted_at', null).neq('is_available', false),
        locationId
            ? supabase.from('inventory_levels').select('variant_id, available').eq('location_id', locationId)
            : Promise.resolve({ data: [], error: null }),
    ]);
    const productRows = must(products) as unknown as {
        id: string; name: string; code: string | null; base_price: number; stock_tracked: boolean;
        product_images: { image_url: string; is_main: boolean; position: number; variant_id: string | null; deleted_at: string | null }[] | null;
    }[];
    const variantRows = must(variants) as unknown as {
        id: string; product_id: string; sku: string | null; price: number | null;
        colors: { name: string; display_name: string | null } | null; sizes: { name: string } | null;
    }[];
    const stock = new Map((must(levels) as { variant_id: string; available: number }[]).map((l) => [l.variant_id, l.available]));
    const discounts = await getActiveProductDiscounts(productRows.map((p) => p.id));

    const byProduct = new Map<string, typeof variantRows>();
    for (const v of variantRows) byProduct.set(v.product_id, [...(byProduct.get(v.product_id) ?? []), v]);

    const out: SellableVariant[] = [];
    for (const p of productRows) {
        const images = (p.product_images ?? []).filter((i) => !i.deleted_at);
        const firstOf = (list: typeof images) => list.find((i) => i.is_main)?.image_url || [...list].sort((a, b) => a.position - b.position)[0]?.image_url || null;
        const discount = discounts.get(p.id)?.discount_percent ?? 0;
        const priced = (base: number) => Math.round(discount > 0 && discount <= 100 ? base * (1 - discount / 100) : base);
        const list = byProduct.get(p.id) ?? [];
        if (!list.length) {
            out.push({ product_id: p.id, variant_id: null, name: p.name, label: '', sku: null, code: p.code, price: priced(Number(p.base_price)),
                base_price: Number(p.base_price), discount_percent: discount, image: firstOf(images.filter((i) => !i.variant_id)), tracked: p.stock_tracked, stock: null });
            continue;
        }
        for (const v of list) {
            const base = v.price != null ? Number(v.price) : Number(p.base_price);
            out.push({
                product_id: p.id,
                variant_id: v.id,
                name: p.name,
                label: [v.colors?.display_name || v.colors?.name, v.sizes?.name].filter(Boolean).join(' / '),
                sku: v.sku,
                code: p.code,
                price: priced(base),
                base_price: base,
                discount_percent: discount,
                image: firstOf(images.filter((i) => i.variant_id === v.id)) || firstOf(images.filter((i) => !i.variant_id)),
                tracked: p.stock_tracked,
                stock: p.stock_tracked ? stock.get(v.id) ?? 0 : null,
            });
        }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name) || a.label.localeCompare(b.label));
}
