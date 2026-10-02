import supabase from '@/lib/supabaseClient';
import { isDiscountValid, type ProductDiscount } from '@/lib/product-discounts';
import { calculateShipping, getCountryCode } from '@/lib/shipping';
import { getCountryTaxRate } from '@/lib/get-site-settings';

export type OrderPricingErrorCode = 'PRODUCT_UNAVAILABLE' | 'PRICES_CHANGED' | 'TOTALS_CHANGED' | 'OUT_OF_STOCK' | 'VARIANT_REQUIRED';

export interface PricedProduct {
    name: string;
    name_ar: string | null;
    name_fr: string | null;
    image: string | null;
}

export interface PricedVariant {
    id: string;
    /** e.g. "Black / XL", stored on order_items so staff know what to pick. */
    label: string;
}

export interface PricedOrder {
    /** Catalog data for order_items, so stored names/images never come from the client. */
    products: Map<string, PricedProduct>;
    /** Resolved variant per cart line (same order as the input lines); null when the product has none. */
    variants: (PricedVariant | null)[];
    subtotal: number;
    shippingCost: number;
    tax: number;
    total: number;
}

type PricingResult = { ok: true; pricing: PricedOrder } | { ok: false; code: OrderPricingErrorCode };

interface CartLine {
    id: string;
    variantId?: string | null;
    price: number;
    quantity: number;
}

interface CatalogVariant {
    id: string;
    product_id: string;
    price: number | null;
    stock: number;
    is_available: boolean;
    colors: { name: string; display_name: string | null } | null;
    sizes: { name: string } | null;
}

interface CatalogProduct {
    id: string;
    name: string;
    name_ar: string | null;
    name_fr: string | null;
    base_price: number;
    stock_tracked: boolean;
    product_images: { image_url: string; is_main: boolean; position: number; variant_id: string | null }[] | null;
}

const CENT = 0.01;

/**
 * Unit prices the storefront can legitimately show for a product: the base or
 * any live variant price, with no discount or any currently valid discount,
 * rounded the way the product pages round before adding to the cart.
 */
function allowedUnitPrices(
    basePrice: number,
    variantPrices: number[],
    discounts: ProductDiscount[]
): number[] {
    const discountPercents = [0, ...discounts.filter(isDiscountValid).map((d) => Number(d.discount_percent))];
    return [basePrice, ...variantPrices].flatMap((price) =>
        discountPercents.map((percent) => Math.round(price * (1 - percent / 100)))
    );
}

/**
 * Re-prices a checkout on the server so orders never store client-supplied
 * amounts. Reads go through the public client, so only live products count.
 */
export async function priceOrder(
    lines: CartLine[],
    country: string | undefined,
    clientTotal: number
): Promise<PricingResult> {
    const productIds = [...new Set(lines.map((line) => line.id))];

    const [productsResult, variantsResult, discountsResult] = await Promise.all([
        supabase
            .from('products')
            .select('id, name, name_ar, name_fr, base_price, stock_tracked, product_images(image_url, is_main, position, variant_id)')
            .in('id', productIds),
        supabase
            .from('product_variants')
            .select('id, product_id, price, stock, is_available, colors(name, display_name), sizes(name)')
            .in('product_id', productIds)
            .is('deleted_at', null),
        supabase.from('product_discounts').select('*').in('product_id', productIds),
    ]);

    if (productsResult.error || variantsResult.error || discountsResult.error) {
        throw productsResult.error || variantsResult.error || discountsResult.error;
    }

    const basePrices = new Map<string, number>();
    const tracked = new Map<string, boolean>();
    const products = new Map<string, PricedProduct>();
    for (const p of (productsResult.data ?? []) as unknown as CatalogProduct[]) {
        basePrices.set(p.id, Number(p.base_price));
        tracked.set(p.id, p.stock_tracked);
        const images = (p.product_images ?? [])
            .filter((img) => !img.variant_id)
            .sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.position - b.position);
        products.set(p.id, { name: p.name, name_ar: p.name_ar, name_fr: p.name_fr, image: images[0]?.image_url ?? null });
    }
    if (productIds.some((id) => !products.has(id))) {
        return { ok: false, code: 'PRODUCT_UNAVAILABLE' };
    }

    const allVariants = (variantsResult.data ?? []) as unknown as CatalogVariant[];
    const variants: (PricedVariant | null)[] = [];
    const requested = new Map<string, number>(); // units per variant across lines

    for (const line of lines) {
        const productVariants = allVariants.filter((v) => v.product_id === line.id);
        // Older carts have no variant: a product with a single variant can still be resolved.
        const variant = line.variantId
            ? productVariants.find((v) => v.id === line.variantId)
            : productVariants.length === 1 ? productVariants[0] : undefined;

        if (line.variantId && (!variant || !variant.is_available)) {
            return { ok: false, code: 'PRODUCT_UNAVAILABLE' };
        }
        if (!variant && tracked.get(line.id) && productVariants.length > 1) {
            return { ok: false, code: 'VARIANT_REQUIRED' };
        }

        // With a known variant only its own price counts; otherwise any live price of the product.
        const prices = variant
            ? []
            : productVariants.filter((v) => v.price !== null).map((v) => Number(v.price));
        const base = variant?.price != null ? Number(variant.price) : basePrices.get(line.id)!;
        const discounts = (discountsResult.data ?? []).filter((d: ProductDiscount) => d.product_id === line.id);
        const allowed = allowedUnitPrices(base, prices, discounts);

        if (!allowed.some((price) => Math.abs(price - line.price) < CENT)) {
            return { ok: false, code: 'PRICES_CHANGED' };
        }

        if (variant) {
            const units = (requested.get(variant.id) ?? 0) + line.quantity;
            requested.set(variant.id, units);
            if (tracked.get(line.id) && units > variant.stock) {
                return { ok: false, code: 'OUT_OF_STOCK' };
            }
            const color = variant.colors ? variant.colors.display_name || variant.colors.name : null;
            const label = [color, variant.sizes?.name].filter(Boolean).join(' / ');
            variants.push({ id: variant.id, label });
        } else {
            variants.push(null);
        }
    }

    const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const countryCode = getCountryCode(country || 'Tunisia');
    const [{ cost: shippingCost }, taxRate] = await Promise.all([
        calculateShipping(countryCode, subtotal, 'standard'),
        getCountryTaxRate(countryCode),
    ]);
    const tax = subtotal * Number(taxRate);
    const total = subtotal + Number(shippingCost) + tax;

    if (Math.abs(total - clientTotal) >= CENT) {
        return { ok: false, code: 'TOTALS_CHANGED' };
    }

    return { ok: true, pricing: { products, variants, subtotal, shippingCost: Number(shippingCost), tax, total } };
}
