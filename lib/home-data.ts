import supabase from '@/lib/supabaseClient';
import { getProductImageUrl } from '@/lib/product-images';
import { cachedCatalogQuery } from '@/lib/catalog-cache';
import { getLandingConfig, getPickedIds } from '@/lib/landing-products';

/**
 * Home page data, loaded on the server from the Next.js data cache (tag "catalog")
 * so the sections render in the first HTML instead of fetching after hydration.
 * The /api/products/top and /api/products/promo routes serve the same cached data.
 */

type TopProductImage = { id: string; image_url: string; alt_text?: string | null; is_main: boolean; position: number };
type TopReview = { rating?: number | null };
type TopProductRow = { id: string; name: string; name_ar?: string | null; name_fr?: string | null; slug: string; description?: string | null; base_price?: number | null; category_id?: string | null; status: string; sold_count?: number | null; product_images?: TopProductImage[]; reviews?: TopReview[] | null };
type DiscountRow = { product_id: string; discount_percent: number; ends_at: string | null };

async function loadTopProducts(): Promise<{ products: unknown[] }> {
    try {
        // 1. Products the admin pinned (Admin → Landing page) first, in their order, then the
        //    best sellers if autofill is on.
        const [config, pinnedIds] = await Promise.all([getLandingConfig(), getPickedIds('top_products')]);
        const { count, autofill } = config.lists.top_products;
        const topQuery = () => supabase
            .from('products')
            .select(`
                id, name, name_ar, name_fr, slug, description, base_price, category_id, status, sold_count, created_at,
                product_images (id, image_url, alt_text, is_main, position),
                reviews:reviews (rating)
            `)
            .eq('status', 'active')
            .is('deleted_at', null)
            .is('product_images.variant_id', null);
        const [pinnedResult, autoResult] = await Promise.all([
            pinnedIds.length > 0 ? topQuery().in('id', pinnedIds) : Promise.resolve({ data: [], error: null }),
            autofill
                ? topQuery()
                    .order('sold_count', { ascending: false, nullsFirst: false })
                    .order('created_at', { ascending: false })
                    .limit(count + pinnedIds.length)
                : Promise.resolve({ data: [], error: null }),
        ]);
        const productsError = pinnedResult.error || autoResult.error;
        const pinnedRows = ((pinnedResult.data ?? []) as TopProductRow[])
            .sort((a, b) => pinnedIds.indexOf(a.id) - pinnedIds.indexOf(b.id));
        const productsData = [
            ...pinnedRows,
            ...((autoResult.data ?? []) as TopProductRow[]).filter((p) => !pinnedIds.includes(p.id)),
        ].slice(0, count);

        if (productsError) {
            console.error("❌ Top products error:", productsError);
            return { products: [] };
        }

        if (!productsData || productsData.length === 0) {
            return { products: [] };
        }

        // 2. Fetch active discounts for these products
        const productIds = productsData.map((p: TopProductRow) => p.id);
        const { data: discountsData } = await supabase
            .from('product_discounts')
            .select('product_id, discount_percent, ends_at')
            .in('product_id', productIds)
            .eq('active', true);

        // Create a map for fast lookup
        const discountMap = new Map<string, { discount_percent: number; ends_at: string | null }>();
        if (discountsData) {
            discountsData.forEach((d: DiscountRow) => {
                discountMap.set(String(d.product_id), {
                    discount_percent: d.discount_percent,
                    ends_at: d.ends_at
                });
            });
        }

        // 3. Fetch categories to map category_id to slug
        // (Optional: could be done in the component, but cleaner here)
        const { data: categoriesData } = await supabase
            .from('categories')
            .select('id, slug');

        const categoryMap = new Map<string, string>();
        if (categoriesData) {
            categoriesData.forEach((c: { id: string; slug: string }) => categoryMap.set(c.id, c.slug));
        }

        // 4. Transform data
        const topProducts = productsData.map((product: TopProductRow) => {
            const discount = discountMap.get(String(product.id));
            const categorySlug = product.category_id ? categoryMap.get(product.category_id) || 'all' : 'all';

            const imageUrl = getProductImageUrl(product) || 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400';
            const basePrice = Number(product.base_price ?? 0);

            // Calculate reviews
            const reviews = product.reviews || [];
            const ratedReviews = reviews.filter((r: TopReview) => typeof r?.rating === 'number' && !Number.isNaN(Number(r.rating)));
            const rating = ratedReviews.length > 0
                ? Number((ratedReviews.reduce((sum: number, r: TopReview) => sum + Number(r.rating), 0) / ratedReviews.length).toFixed(1))
                : 0;

            return {
                id: product.id,
                name: product.name,
                name_ar: product.name_ar,
                name_fr: product.name_fr,
                title: product.name,
                slug: product.slug,
                description: product.description,
                base_price: basePrice,
                price_cents: basePrice, // Alias for compatibility
                image_url: imageUrl,
                product_images: product.product_images || [],
                category_id: product.category_id,
                categorySlug: categorySlug,
                currency: 'TND',
                status: product.status,

                // Discount info
                discount_percent: discount?.discount_percent,
                promo_end_date: discount?.ends_at || undefined,

                sold_count: Number(product.sold_count) || 0,
                rating,
                review_count: ratedReviews.length,
            };
        });

        return { products: topProducts };

    } catch (error) {
        console.error('❌ API error:', error);
        throw error; // not cached, so the next request retries
    }
}

async function loadPromoProducts(): Promise<{ products: unknown[] }> {
    try {
        // 1) Active discounts: the products the admin pinned (Admin → Landing page) first, in
        //    their order, then the latest discounts if autofill is on.
        const [config, pinnedIds] = await Promise.all([getLandingConfig(), getPickedIds('promo_products')]);
        const { count, autofill } = config.lists.promo_products;
        // Only discounts on live products, so `count` isn't used up by archived ones.
        const discountQuery = () => supabase
            .from('product_discounts')
            .select('product_id, discount_percent, ends_at, products!inner(id)')
            .eq('active', true)
            .eq('products.status', 'active')
            .is('products.deleted_at', null);
        const [pinnedResult, autoResult] = await Promise.all([
            pinnedIds.length > 0 ? discountQuery().in('product_id', pinnedIds) : Promise.resolve({ data: [], error: null }),
            autofill
                ? discountQuery().order('created_at', { ascending: false }).limit(count + pinnedIds.length)
                : Promise.resolve({ data: [], error: null }),
        ]);
        const discountsError = pinnedResult.error || autoResult.error;

        if (discountsError) throw discountsError; // not cached, so the next request retries

        type PromoDiscount = { product_id: string; discount_percent: number; ends_at: string | null };
        const pinnedDiscounts = ((pinnedResult.data ?? []) as PromoDiscount[])
            .sort((a, b) => pinnedIds.indexOf(a.product_id) - pinnedIds.indexOf(b.product_id));
        const discountsData: PromoDiscount[] = [];
        for (const d of [...pinnedDiscounts, ...((autoResult.data ?? []) as PromoDiscount[])]) {
            if (!discountsData.some((x) => x.product_id === d.product_id)) discountsData.push(d);
        }
        discountsData.splice(count);

        if (discountsData.length === 0) {
            return { products: [] };
        }

        const productIds = discountsData.map((d: { product_id: string }) => String(d.product_id));

        const discountMap = new Map<string, { discount_percent: number; ends_at: string | null }>(
            discountsData.map((d: { product_id: string; discount_percent: number; ends_at: string | null }) => [
                String(d.product_id),
                { discount_percent: d.discount_percent, ends_at: d.ends_at }
            ])
        );

        // 2) Get products
        const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select(`
        id, name, name_ar, name_fr, slug, base_price,sold_count, category_id,
        product_images (id, image_url, alt_text, is_main, position),
        reviews:reviews (rating)
      `)
            .in('id', productIds)
            .eq('status', 'active')
            .is('deleted_at', null);

        if (productsError) throw productsError;

        if (!productsData || productsData.length === 0) {
            return { products: [] };
        }

        // Stock is the sum of live, available variants (fetched separately: embedding
        // variants from products is ambiguous because product_images links both).
        const { data: variantRows } = await supabase
            .from('product_variants')
            .select('product_id, stock')
            .in('product_id', productIds)
            .eq('is_available', true)
            .is('deleted_at', null);
        const stockByProduct = new Map<string, number>();
        for (const v of (variantRows ?? []) as { product_id: string; stock: number }[]) {
            stockByProduct.set(v.product_id, (stockByProduct.get(v.product_id) ?? 0) + Number(v.stock ?? 0));
        }

        // 3) Map productsData to promo format
        // Keep the order chosen above (pinned first).
        productsData.sort((a: { id: string }, b: { id: string }) => productIds.indexOf(String(a.id)) - productIds.indexOf(String(b.id)));
        const promoProducts = productsData.map((product: any) => {
            const discount: { discount_percent: number; ends_at: string | null } | undefined = discountMap.get(String(product.id));
            const imageUrl = getProductImageUrl(product) || 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400';

            const reviews = product.reviews || [];
            const ratedReviews = reviews.filter((r: any) => typeof r?.rating === 'number' && !Number.isNaN(Number(r.rating)));
            const rating = ratedReviews.length > 0
                ? Number((ratedReviews.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / ratedReviews.length).toFixed(1))
                : 0;

            return {
                id: product.id,
                name: product.name,
                name_ar: product.name_ar,
                name_fr: product.name_fr,
                title: product.name,
                slug: product.slug,
                base_price: Number(product.base_price ?? 0),
                price_cents: Number(product.base_price ?? 0),
                image_url: imageUrl,
                category_id: product.category_id,
                currency: 'TND',
                discount_percent: discount?.discount_percent,
                promo_end_date: discount?.ends_at || undefined,
                sold_count: Number(product.sold_count ?? 0),
                stock: stockByProduct.get(product.id) ?? 0,
                rating,
                review_count: ratedReviews.length,
            };
        });

        return { products: promoProducts };
    } catch (error) {
        console.error('❌ API error:', error);
        throw error; // not cached, so the next request retries
    }
}

async function loadFeaturedCategories() {
    const { data, error } = await supabase
        .from('categories')
        .select('id, name, name_ar, name_fr, slug, image_url, sort_order, is_featured, featured_position')
        .eq('is_featured', true)
        // The order set in Admin → Landing page, then the menu order.
        .order('featured_position', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true });
    if (error) throw error;
    return data ?? [];
}

async function loadSaleBanners() {
    const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('active', true)
        .order('discount_percent', { ascending: false });
    if (error) throw error;
    return data ?? [];
}

async function loadReels() {
    const { data, error } = await supabase
        .from('reels')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });
    if (error) throw error;
    return data ?? [];
}

async function loadLatestReviews() {
    const { data, error } = await supabase
        .from('reviews')
        .select('*, users:user_id (id, name, avatar_url)')
        .order('updated_at', { ascending: false })
        .limit(12);
    if (error) throw error;
    return data ?? [];
}

export const getTopProducts = cachedCatalogQuery('top-products', loadTopProducts);
export const getPromoProducts = cachedCatalogQuery('promo-products', loadPromoProducts);
export const getFeaturedCategories = cachedCatalogQuery('featured-categories', loadFeaturedCategories);
export const getSaleBanners = cachedCatalogQuery('sale-banners', loadSaleBanners);
export const getReels = cachedCatalogQuery('reels', loadReels);
// Reviews are posted by shoppers straight to Supabase, so this one isn't tag-invalidated;
// the cache's 5-minute revalidate keeps it fresh enough for the home page.
export const getLatestReviews = cachedCatalogQuery('latest-reviews', loadLatestReviews);
