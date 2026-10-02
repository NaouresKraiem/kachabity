// Server-side product queries for the landing page sections
// (showcase hero, new arrivals, collection spotlight). The admin picks the showcase,
// ring and pinned new arrivals in Admin → Landing page (table landing_products).

import supabase from '@/lib/supabaseClient';
import { getActiveProductDiscounts } from '@/lib/product-discounts';
import { getProductName, getCategoryName, getDescendantCategoryIds } from '@/lib/utils/product-utils';
import { parseLandingConfig, type LandingConfig, type LandingSection, type ListSettings } from '@/lib/landing-config';

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
    if (error) throw error; // not cached: getLandingData falls back without caching
    return data || [];
}

function liveProducts() {
    return supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('status', 'active')
        .is('deleted_at', null);
}

// Admin-editable in Admin → Landing page (site_settings row `landing_config`).
export async function getLandingConfig(): Promise<LandingConfig> {
    const { data, error } = await supabase
        .from('site_settings')
        .select('setting_value')
        .eq('setting_key', 'landing_config')
        .maybeSingle();
    // Throw rather than fall back to the defaults, which would be cached as the admin's choice.
    if (error) throw error;
    return parseLandingConfig(data?.setting_value);
}

// The products the admin picked for a section, in their order.
export async function getPickedIds(section: LandingSection): Promise<string[]> {
    const { data, error } = await supabase
        .from('landing_products')
        .select('product_id')
        .eq('section', section)
        .order('position', { ascending: true });
    if (error) throw error; // not cached: an empty list would look like "nothing picked"
    return ((data ?? []) as { product_id: string }[]).map((row) => row.product_id);
}

// Products by id, returned in the order given; unpublished ones and ones without a photo are skipped.
async function getProductsByIds(locale: string, ids: string[], categories: CategoryRow[]): Promise<LandingProduct[]> {
    if (ids.length === 0) return [];
    const { data, error } = await liveProducts().in('id', ids);
    if (error) throw error;
    const rows = (data as ProductRow[] | null ?? [])
        .filter((r) => mainImage(r.product_images))
        .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    return toLandingProducts(rows, categories, locale);
}

// A section's picks. Showcase and ring fall back to the newest products when nothing is picked.
export async function getLandingPicks(locale: string, section: Exclude<LandingSection, 'new_arrivals'>): Promise<LandingProduct[]> {
    const [ids, categories] = await Promise.all([getPickedIds(section), getCategories()]);
    const picks = await getProductsByIds(locale, ids, categories);
    if (picks.length > 0) return picks;
    return getNewestProducts(locale, section === 'showcase' ? 3 : 11, [], categories);
}

async function getNewestProducts(locale: string, limit: number, excludeIds: string[], categories: CategoryRow[]): Promise<LandingProduct[]> {
    if (limit <= 0) return [];
    const { data, error } = await liveProducts()
        .order('created_at', { ascending: false })
        .limit(limit * 2 + excludeIds.length);
    if (error) {
        console.error('Error fetching new arrivals:', error);
        return [];
    }
    // Products without a photo don't belong in an image-led section.
    const rows = (data as ProductRow[] | null ?? [])
        .filter((r) => !excludeIds.includes(r.id) && mainImage(r.product_images))
        .slice(0, limit);
    return toLandingProducts(rows, categories, locale);
}

// Pinned products first (in the admin's order), then the newest products if autofill is on.
export async function getNewArrivals(locale: string, settings: ListSettings): Promise<LandingProduct[]> {
    const [ids, categories] = await Promise.all([getPickedIds('new_arrivals'), getCategories()]);
    const pinned = (await getProductsByIds(locale, ids, categories)).slice(0, settings.count);
    if (!settings.autofill) return pinned;
    const newest = await getNewestProducts(locale, settings.count - pinned.length, pinned.map((p) => p.id), categories);
    return [...pinned, ...newest];
}

// Spotlights the category the admin chose, or else the top-level category with the most
// live products in its subtree. Pinned products come first, then its best sellers (autofill).
export async function getSpotlightCollection(
    locale: string,
    settings: ListSettings,
    categoryId: string | null
): Promise<SpotlightCollection | null> {
    const categories = await getCategories();

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
    const subtree = (root: CategoryRow) => {
        const ids = getDescendantCategoryIds(root.id, categories);
        return { root, ids, total: ids.reduce((sum, id) => sum + (perCategory.get(id) || 0), 0) };
    };

    const chosen = categoryId ? categories.find((c) => c.id === categoryId) : undefined;
    let best: { root: CategoryRow; ids: string[]; total: number } | null = chosen ? subtree(chosen) : null;
    if (!best) {
        for (const root of categories.filter((c) => !c.parent_id)) {
            const candidate = subtree(root);
            if (!best || candidate.total > best.total) best = candidate;
        }
    }
    if (!best) return null;

    const pinnedIds = await getPickedIds('spotlight');
    const pinned = (await getProductsByIds(locale, pinnedIds, categories)).slice(0, settings.count);
    let filled: LandingProduct[] = [];
    const remaining = settings.count - pinned.length;
    if (settings.autofill && remaining > 0 && best.ids.length > 0) {
        const { data, error } = await liveProducts()
            .in('category_id', best.ids)
            .order('sold_count', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(remaining + pinned.length);
        if (error) {
            console.error('Error fetching spotlight products:', error);
            return null;
        }
        const rows = (data as ProductRow[] | null ?? [])
            .filter((r) => mainImage(r.product_images) && !pinned.some((p) => p.id === r.id))
            .slice(0, remaining);
        filled = await toLandingProducts(rows, categories, locale);
    }

    const products = [...pinned, ...filled];
    if (products.length < 3) return null;
    const rootId = best.root.id;

    return {
        name: getCategoryName(best.root, locale).trim(),
        slug: best.root.slug,
        productCount: Math.max(best.total, products.length),
        subcategories: categories
            .filter((c) => c.parent_id === rootId)
            .map((c) => ({ name: getCategoryName(c, locale).trim(), slug: c.slug })),
        products,
    };
}
