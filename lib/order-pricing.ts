import supabase from '@/lib/supabaseClient';
import { isDiscountValid, type ProductDiscount } from '@/lib/product-discounts';
import { calculateShipping, getCountryCode } from '@/lib/shipping';
import { getCountryTaxRate } from '@/lib/get-site-settings';

export type OrderPricingErrorCode = 'PRODUCT_UNAVAILABLE' | 'PRICES_CHANGED' | 'TOTALS_CHANGED';

export interface PricedProduct {
    name: string;
    name_ar: string | null;
    name_fr: string | null;
    image: string | null;
}

export interface PricedOrder {
    /** Catalog data for order_items, so stored names/images never come from the client. */
    products: Map<string, PricedProduct>;
    subtotal: number;
    shippingCost: number;
    tax: number;
    total: number;
}

type PricingResult = { ok: true; pricing: PricedOrder } | { ok: false; code: OrderPricingErrorCode };

interface CartLine {
    id: string;
    price: number;
    quantity: number;
}

interface CatalogProduct {
    id: string;
    name: string;
    name_ar: string | null;
    name_fr: string | null;
    base_price: number;
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
            .select('id, name, name_ar, name_fr, base_price, product_images(image_url, is_main, position, variant_id)')
            .in('id', productIds),
        supabase.from('product_variants').select('product_id, price').in('product_id', productIds),
        supabase.from('product_discounts').select('*').in('product_id', productIds),
    ]);

    if (productsResult.error || variantsResult.error || discountsResult.error) {
        throw productsResult.error || variantsResult.error || discountsResult.error;
    }

    const basePrices = new Map<string, number>();
    const products = new Map<string, PricedProduct>();
    for (const p of (productsResult.data ?? []) as CatalogProduct[]) {
        basePrices.set(p.id, Number(p.base_price));
        const images = (p.product_images ?? [])
            .filter((img) => !img.variant_id)
            .sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.position - b.position);
        products.set(p.id, { name: p.name, name_ar: p.name_ar, name_fr: p.name_fr, image: images[0]?.image_url ?? null });
    }
    if (productIds.some((id) => !products.has(id))) {
        return { ok: false, code: 'PRODUCT_UNAVAILABLE' };
    }

    for (const line of lines) {
        const variantPrices = (variantsResult.data ?? [])
            .filter((v: { product_id: string; price: number | null }) => v.product_id === line.id && v.price !== null)
            .map((v: { price: number }) => Number(v.price));
        const discounts = (discountsResult.data ?? []).filter((d: ProductDiscount) => d.product_id === line.id);
        const allowed = allowedUnitPrices(basePrices.get(line.id)!, variantPrices, discounts);

        if (!allowed.some((price) => Math.abs(price - line.price) < CENT)) {
            return { ok: false, code: 'PRICES_CHANGED' };
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

    return { ok: true, pricing: { products, subtotal, shippingCost: Number(shippingCost), tax, total } };
}
