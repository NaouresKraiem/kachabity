// Order lines for a parcel entered by hand with products (Admin → Delivery → New parcel).
// Names, photos and prices come from the catalog, with the storefront's rule:
// round(variant or base price × (1 − active discount%)).
import supabase from '@/lib/supabase-admin';
import { getActiveProductDiscounts } from '@/lib/product-discounts';

export interface ManualLineInput {
    product_id: string;
    variant_id?: string | null;
    quantity: number;
}

interface ProductRow {
    id: string;
    stock_tracked: boolean;
    name: string;
    name_ar: string | null;
    name_fr: string | null;
    base_price: number;
    product_images: { image_url: string; is_main: boolean; position: number; variant_id: string | null }[] | null;
}

interface VariantRow {
    id: string;
    product_id: string;
    price: number | null;
    stock: number;
    colors: { name: string; display_name: string | null } | null;
    sizes: { name: string } | null;
}

/** A refusal to show the admin as is (unknown product, size/colour missing). */
export class ManualLineError extends Error {}

/**
 * Priced lines in create_order's shape, plus `stock`: units the online location holds for the
 * line's variant, or null when the product isn't stock-tracked (always orderable). Validating the
 * order takes what's in stock; the rest is made to order.
 */
export async function buildManualOrderLines(input: ManualLineInput[]) {
    const productIds = [...new Set(input.map((line) => line.product_id))];
    const [productsResult, variantsResult, discounts] = await Promise.all([
        supabase
            .from('products')
            .select('id, name, name_ar, name_fr, base_price, stock_tracked, product_images(image_url, is_main, position, variant_id)')
            .in('id', productIds)
            .is('deleted_at', null)
            .is('product_images.deleted_at', null),
        supabase
            .from('product_variants')
            .select('id, product_id, price, stock, colors(name, display_name), sizes(name)')
            .in('product_id', productIds)
            .is('deleted_at', null)
            .neq('is_available', false),
        getActiveProductDiscounts(productIds),
    ]);
    if (productsResult.error) throw productsResult.error;
    if (variantsResult.error) throw variantsResult.error;
    const products = new Map((productsResult.data as unknown as ProductRow[]).map((p) => [p.id, p]));
    const variants = variantsResult.data as unknown as VariantRow[];

    return input.map((line) => {
        const product = products.get(line.product_id);
        if (!product) throw new ManualLineError('A selected product no longer exists');
        const productVariants = variants.filter((v) => v.product_id === product.id);
        const variant = line.variant_id ? productVariants.find((v) => v.id === line.variant_id) : undefined;
        if (line.variant_id && !variant) throw new ManualLineError(`The size/colour chosen for ${product.name} is no longer available`);
        if (!variant && productVariants.length > 1) throw new ManualLineError(`Choose a size/colour for ${product.name}`);
        const chosen = variant ?? productVariants[0];

        const base = chosen?.price != null ? Number(chosen.price) : Number(product.base_price);
        const discount = discounts.get(product.id)?.discount_percent ?? 0;
        const price = Math.round(discount > 0 && discount <= 100 ? base * (1 - discount / 100) : base);
        // The variant's own photo first, then the product's main photo.
        const all = product.product_images ?? [];
        const firstOf = (images: typeof all) => images.find((img) => img.is_main)?.image_url || [...images].sort((a, b) => a.position - b.position)[0]?.image_url;
        const image = (chosen && firstOf(all.filter((img) => img.variant_id === chosen.id))) || firstOf(all.filter((img) => !img.variant_id)) || null;
        const label = chosen ? [chosen.colors?.display_name || chosen.colors?.name, chosen.sizes?.name].filter(Boolean).join(' / ') : '';

        return {
            product_id: product.id,
            variant_id: chosen?.id ?? null,
            variant_label: label || null,
            product_name: product.name,
            product_name_ar: product.name_ar,
            product_name_fr: product.name_fr,
            product_image: image,
            quantity: line.quantity,
            price,
            subtotal: price * line.quantity,
            stock: product.stock_tracked && chosen ? Number(chosen.stock) : null,
        };
    });
}
