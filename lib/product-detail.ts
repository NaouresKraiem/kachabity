import supabase from '@/lib/supabaseClient';
import { getActiveProductDiscount, getActiveProductDiscounts } from '@/lib/product-discounts';

/**
 * Everything the product page needs except reviews, assembled in one place so the
 * server (cached via lib/catalog-cache.ts) and the browser (fallback) share the logic.
 * Uses public reads only, so it works with the publishable-key client on either side.
 */

interface ImageRow { id: string; image_url: string; alt_text: string | null; is_main?: boolean; position?: number; variant_id?: string | null }
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

const toImage = (img: ImageRow) => ({ id: img.id, url: img.image_url, alt: img.alt_text });

export async function loadProductDetail(slug: string): Promise<ProductDetailData | null> {
    const { data: row, error } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .is('deleted_at', null)
        .eq('status', 'active')
        .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    const product = row as ProductRow;

    const [images, variants, variantImages, discount, similar, categories] = await Promise.all([
        supabase.from('product_images').select('*').eq('product_id', product.id).is('variant_id', null).order('position', { ascending: true }),
        supabase.from('product_variants')
            .select('*, colors (id, name, hex_code, display_name), sizes (id, name, display_name)')
            .eq('product_id', product.id).is('deleted_at', null),
        supabase.from('product_images').select('*').eq('product_id', product.id).not('variant_id', 'is', null).order('position', { ascending: true }),
        getActiveProductDiscount(product.id),
        product.category_id
            ? supabase.from('products').select('*, product_images(id, image_url, alt_text, is_main, position, variant_id)')
                .eq('category_id', product.category_id).neq('id', product.id)
                .is('deleted_at', null).eq('status', 'active').limit(4)
            : Promise.resolve({ data: [] as ProductRow[] }),
        supabase.from('categories').select('id, name, name_ar, name_fr, slug').order('name', { ascending: true }),
    ]);

    const variantImageRows = (variantImages.data ?? []) as ImageRow[];
    const similarRows = (similar.data ?? []) as (ProductRow & { product_images?: ImageRow[] })[];
    const similarDiscounts = await getActiveProductDiscounts(similarRows.map((p) => p.id));

    return {
        product: {
            ...product,
            // Discounts live in product_discounts, not on the product row.
            discount_percent: discount?.discount_percent ? Number(discount.discount_percent) : 0,
            product_images: ((images.data ?? []) as ImageRow[]).map(toImage),
            product_variants: ((variants.data ?? []) as VariantRow[]).map((v) => ({
                ...v,
                images: variantImageRows.filter((img) => img.variant_id === v.id).map(toImage),
            })),
        },
        similarProducts: similarRows.map(({ product_images, ...p }) => {
            const gallery = (product_images ?? [])
                .filter((img) => !img.variant_id)
                .sort((a, b) => Number(b.is_main) - Number(a.is_main) || (a.position ?? 0) - (b.position ?? 0));
            return {
                ...p,
                image_url: gallery[0]?.image_url,
                discount_percent: Number(similarDiscounts.get(p.id)?.discount_percent ?? 0),
            };
        }),
        relatedCategories: ((categories.data ?? []) as ProductDetailData['relatedCategories'])
            .filter((c) => c.id !== product.category_id)
            .slice(0, 6),
    };
}
