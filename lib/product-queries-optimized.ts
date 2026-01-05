// Optimized product queries with fewer database calls
import supabase from './supabaseClient';
import cache, { CACHE_DURATION } from './cache';

export interface OptimizedProduct {
    id: string;
    name: string;
    name_ar?: string;
    name_fr?: string;
    slug: string;
    description?: string;
    description_ar?: string;
    description_fr?: string;
    base_price: number;
    discount_percent?: number;
    stock_quantity: number;
    category_id: string;
    active: boolean;
    main_image?: string; // Pre-fetched main image URL
    image_count?: number; // Total number of images
    variant_count?: number; // Total number of variants
}

/**
 * Fetch products with optimized single query including images
 * This reduces multiple round-trips to the database
 */
export async function getProductsOptimized(options: {
    categoryId?: string;
    limit?: number;
    offset?: number;
    searchQuery?: string;
}) {
    const { categoryId, limit = 20, offset = 0, searchQuery } = options;

    // Create cache key
    const cacheKey = `products_${categoryId || 'all'}_${limit}_${offset}_${searchQuery || ''}`;

    // Check cache first
    const cached = cache.get<any>(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        // Build query
        let query = supabase
            .from('products')
            .select(`
                id,
                name,
                name_ar,
                name_fr,
                slug,
                description,
                description_ar,
                description_fr,
                base_price,
                discount_percent,
                stock_quantity,
                category_id,
                active,
                product_images!inner(
                    image_url,
                    is_main,
                    position
                )
            `, { count: 'exact' })
            .eq('active', true)
            .order('created_at', { ascending: false });

        // Add category filter
        if (categoryId && categoryId !== 'all') {
            query = query.eq('category_id', categoryId);
        }

        // Add search filter
        if (searchQuery) {
            query = query.or(`name.ilike.%${searchQuery}%,name_ar.ilike.%${searchQuery}%,name_fr.ilike.%${searchQuery}%`);
        }

        // Add pagination
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        // Process products to extract main image
        const products = (data || []).map(product => {
            const images = product.product_images || [];
            const mainImage = images.find((img: any) => img.is_main)?.image_url ||
                images[0]?.image_url ||
                null;

            return {
                ...product,
                main_image: mainImage,
                image_count: images.length,
                // Remove raw images array to reduce payload size
                product_images: undefined
            };
        });

        const result = {
            products,
            count: count || 0
        };

        // Cache the result
        cache.set(cacheKey, result, CACHE_DURATION.PRODUCTS);

        return result;
    } catch (error) {
        console.error('Error fetching optimized products:', error);
        throw error;
    }
}

/**
 * Get single product with all related data in one query
 */
export async function getProductBySlugOptimized(slug: string) {
    const cacheKey = `product_${slug}`;

    // Check cache
    const cached = cache.get<any>(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        const { data, error } = await supabase
            .from('products')
            .select(`
                *,
                category:categories(id, name, name_ar, name_fr, slug),
                product_images(
                    id,
                    image_url,
                    alt,
                    is_main,
                    position
                ),
                variants(
                    id,
                    name,
                    price,
                    stock_quantity,
                    active,
                    size_id,
                    color_id,
                    sizes(name),
                    colors(name, hex_code)
                )
            `)
            .eq('slug', slug)
            .eq('active', true)
            .single();

        if (error) throw error;

        // Sort images by position
        if (data.product_images) {
            data.product_images.sort((a: any, b: any) => a.position - b.position);
        }

        // Cache for 2 minutes
        cache.set(cacheKey, data, CACHE_DURATION.PRODUCTS);

        return data;
    } catch (error) {
        console.error('Error fetching product by slug:', error);
        throw error;
    }
}

/**
 * Clear product cache (use after creating/updating products)
 */
export function clearProductCache(slug?: string) {
    if (slug) {
        cache.clear(`product_${slug}`);
    }
    // Clear all product list caches
    cache.clear();
}

