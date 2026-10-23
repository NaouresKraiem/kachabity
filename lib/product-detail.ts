import { storefront } from '@/lib/storefront-api';

/**
 * Everything the product page needs except reviews, from the NestJS API: the server caches it
 * (lib/catalog-cache.ts) and the browser uses it as a fallback.
 */

interface VariantRow { id: string; [key: string]: unknown }
interface ProductRow { id: string; category_id: string | null; [key: string]: unknown }

export interface ProductDetailData {
    product: ProductRow & {
        discount_percent: number;
        product_images: { id: string; url: string; alt: string | null }[];
        product_variants: (VariantRow & { images: { id: string; url: string; alt: string | null }[] })[];
    };
    similarProducts: (ProductRow & { image_url?: string; discount_percent: number })[];
    relatedCategories: { id: string; name: string; name_ar?: string; name_fr?: string; slug: string }[];
}

export function loadProductDetail(slug: string): Promise<ProductDetailData | null> {
    return storefront<ProductDetailData | null>(`product?slug=${encodeURIComponent(slug)}`);
}
