// Server-side product queries for the landing page sections
// (showcase hero, new arrivals, collection spotlight).

import supabase from '@/lib/supabaseClient';
import { getActiveProductDiscounts } from '@/lib/product-discounts';
import { getProductName, getCategoryName, getDescendantCategoryIds } from '@/lib/utils/product-utils';

export interface LandingProduct {
    id: string;
    slug: string;
    name: string;
    image: string | null;
    price: number;
    originalPrice: number | null;
    discountPercent: number;
    categoryName: string | null;
}

export interface SpotlightCollection {
    name: string;
    slug: string;
    productCount: number;
    subcategories: { name: string; slug: string }[];
    products: LandingProduct[];
}

interface CategoryRow {
    id: string;
    name: string;
    name_ar: string | null;
    name_fr: string | null;
    slug: string;
    parent_id: string | null;
    sort_order: number | null;
}

interface ProductRow {
    id: string;
    slug: string;
    name: string;
    name_ar: string | null;
    name_fr: string | null;
    base_price: number;
    category_id: string | null;
    product_images: { image_url: string; is_main: boolean; position: number; variant_id: string | null }[] | null;
}

const PRODUCT_SELECT =
    'id, slug, name, name_ar, name_fr, base_price, category_id, product_images(image_url, is_main, position, variant_id)';

function mainImage(images: ProductRow['product_images']): string | null {
    if (!images || images.length === 0) return null;
    const productLevel = images.filter((img) => !img.variant_id);
    const pool = productLevel.length > 0 ? productLevel : images;
    const main = pool.find((img) => img.is_main);
    if (main) return main.image_url;
    return [...pool].sort((a, b) => a.position - b.position)[0].image_url;
}

// Prices follow the storefront rule: round(base × (1 − discount%)).
async function toLandingProducts(
    rows: ProductRow[],
    categories: CategoryRow[],
    locale: string
): Promise<LandingProduct[]> {
    const discounts = await getActiveProductDiscounts(rows.map((r) => r.id));
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    return rows.map((row) => {
        const base = Number(row.base_price);
        const discountPercent = discounts.get(row.id)?.discount_percent ?? 0;
        const hasDiscount = discountPercent > 0 && discountPercent <= 100;
        const category = row.category_id ? categoryById.get(row.category_id) : undefined;

        return {
            id: row.id,
            slug: row.slug,
            name: getProductName(row, locale),
            image: mainImage(row.product_images),
            price: Math.round(hasDiscount ? base * (1 - discountPercent / 100) : base),
            originalPrice: hasDiscount ? Math.round(base) : null,
            discountPercent: hasDiscount ? Math.round(discountPercent) : 0,
            categoryName: category ? getCategoryName(category, locale) : null,
        };
    });
}

async function getCategories(): Promise<CategoryRow[]> {
    const { data, error } = await supabase
        .from('categories')
        .select('id, name, name_ar, name_fr, slug, parent_id, sort_order')
        .order('sort_order', { ascending: true });
    if (error) {
        console.error('Error fetching categories for landing page:', error);
        return [];
    }
    return data || [];
}

function liveProducts() {
    return supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('status', 'active')
        .is('deleted_at', null);
}

export async function getNewArrivals(locale: string, limit = 8): Promise<LandingProduct[]> {
    const [{ data, error }, categories] = await Promise.all([
        liveProducts().order('created_at', { ascending: false }).limit(limit * 2),
        getCategories(),
    ]);
    if (error) {
        console.error('Error fetching new arrivals:', error);
        return [];
    }
    // Products without a photo don't belong in an image-led section.
    const withImages = (data as ProductRow[] | null ?? []).filter((r) => mainImage(r.product_images));
    return toLandingProducts(withImages.slice(0, limit), categories, locale);
}

// Products by slug, returned in the order given; missing or unpublished slugs are skipped.
export async function getProductsBySlugs(locale: string, slugs: string[]): Promise<LandingProduct[]> {
    const [{ data, error }, categories] = await Promise.all([
        liveProducts().in('slug', slugs),
        getCategories(),
    ]);
    if (error) {
        console.error('Error fetching products by slug:', error);
        return [];
    }
    const rows = (data as ProductRow[] | null ?? [])
        .filter((r) => mainImage(r.product_images))
        .sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug));
    return toLandingProducts(rows, categories, locale);
}

// Spotlights the top-level category with the most live products in its subtree.
export async function getSpotlightCollection(locale: string, limit = 10): Promise<SpotlightCollection | null> {
    const categories = await getCategories();
    const roots = categories.filter((c) => !c.parent_id);
    if (roots.length === 0) return null;

    const { data: counts, error: countError } = await supabase
        .from('products')
        .select('category_id')
        .eq('status', 'active')
        .is('deleted_at', null);
    if (countError) {
        console.error('Error counting products per category:', countError);
        return null;
    }

    const perCategory = new Map<string, number>();
    for (const row of counts || []) {
        if (row.category_id) perCategory.set(row.category_id, (perCategory.get(row.category_id) || 0) + 1);
    }

    let best: { root: CategoryRow; ids: string[]; total: number } | null = null;
    for (const root of roots) {
        const ids = getDescendantCategoryIds(root.id, categories);
        const total = ids.reduce((sum, id) => sum + (perCategory.get(id) || 0), 0);
        if (!best || total > best.total) best = { root, ids, total };
    }
    if (!best || best.total < 3) return null;

    const { data, error } = await liveProducts()
        .in('category_id', best.ids)
        .order('sold_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) {
        console.error('Error fetching spotlight products:', error);
        return null;
    }

    const rows = (data as ProductRow[] | null ?? []).filter((r) => mainImage(r.product_images));
    const products = await toLandingProducts(rows, categories, locale);
    const bestRootId = best.root.id;

    return {
        name: getCategoryName(best.root, locale).trim(),
        slug: best.root.slug,
        productCount: best.total,
        subcategories: categories
            .filter((c) => c.parent_id === bestRootId)
            .map((c) => ({ name: getCategoryName(c, locale).trim(), slug: c.slug })),
        products,
    };
}
