import supabase from "./supabaseClient";
import { getActiveProductDiscounts } from "./product-discounts";
import { getProductImageUrl } from "./product-images";

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || "TND";
const FALLBACK_IMAGE_URL = "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400";

export interface Favorite {
    id: string;
    user_id: string;
    product_id: string;
    created_at: string;
}

export interface FavoriteWithProduct {
    id: string;
    user_id: string;
    product_id: string;
    created_at: string;
    product: {
        id: string;
        title: string;
        slug: string;
        price_cents: number;
        currency: string;
        image_url: string;
        stock?: number | null;
        rating?: number;
        review_count?: number;
        discount_percent?: number;
    };
}

/**
 * Add a product to user's favorites
 */
export async function addToFavorites(userId: string, productId: string): Promise<{ success: boolean; error: Error | null }> {
    try {
        const { error } = await supabase
            .from("user_favorites")
            .insert({
                user_id: userId,
                product_id: productId
            });

        if (error) {
            console.error("Error adding to favorites:", error);
            return { success: false, error };
        }

        return { success: true, error: null };
    } catch (error) {
        console.error("Error in addToFavorites:", error);
        return { success: false, error: error as Error };
    }
}

/**
 * Remove a product from user's favorites
 */
export async function removeFromFavorites(userId: string, productId: string): Promise<{ success: boolean; error: Error | null }> {
    try {
        const { error } = await supabase
            .from("user_favorites")
            .delete()
            .eq("user_id", userId)
            .eq("product_id", productId);

        if (error) {
            console.error("Error removing from favorites:", error);
            return { success: false, error };
        }

        return { success: true, error: null };
    } catch (error) {
        console.error("Error in removeFromFavorites:", error);
        return { success: false, error: error as Error };
    }
}

/**
 * Toggle favorite status (add if not exists, remove if exists)
 */
export async function toggleFavorite(userId: string, productId: string): Promise<{ isFavorited: boolean; error: Error | null }> {
    try {
        // Check if already favorited - use maybeSingle() to avoid PGRST116 error
        const { data: existing, error: checkError } = await supabase
            .from("user_favorites")
            .select("id")
            .eq("user_id", userId)
            .eq("product_id", productId)
            .maybeSingle(); // Returns null if not found, no error

        if (checkError) {
            console.error("Error checking favorite:", checkError);
            return { isFavorited: false, error: checkError };
        }

        if (existing) {
            // Already favorited, remove it
            const { error } = await removeFromFavorites(userId, productId);
            return { isFavorited: false, error };
        } else {
            // Not favorited, add it
            const { error } = await addToFavorites(userId, productId);
            return { isFavorited: true, error };
        }
    } catch (error) {
        console.error("Error in toggleFavorite:", error);
        return { isFavorited: false, error: error as Error };
    }
}

/**
 * Get all favorites for a user with product details
 */
export async function getUserFavorites(userId: string): Promise<{ favorites: FavoriteWithProduct[]; error: Error | null }> {
    try {
        const { data, error } = await supabase
            .from("user_favorites")
            .select(`
                id,
                user_id,
                product_id,
                created_at,
                products (
                    id,
                    name,
                    slug,
                    description,
                    base_price,
                    category_id,
                    status,
                    product_images (
                        id,
                        product_id,
                        image_url,
                        alt_text,
                        is_main,
                        position
                    ),
                    reviews:reviews (
                        rating
                    )
                )
            `)
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching favorites:", error);
            return { favorites: [], error };
        }

        type FavoriteRow = {
            id: string;
            user_id: string;
            product_id: string;
            created_at: string;
            products: any;
        };

        type FavoriteWithMaybeProduct = Omit<FavoriteWithProduct, "product"> & {
            product: FavoriteWithProduct["product"] | null;
        };

        // Get product IDs to fetch discounts
        const productIds = ((data as FavoriteRow[] | null) ?? [])
            .map((fav) => fav.products?.id)
            .filter((id): id is string => !!id);

        // Fetch discounts for all products in batch
        const discountMap = await getActiveProductDiscounts(productIds);

        // Transform the data to match our interface
        const favorites: FavoriteWithProduct[] = ((data as FavoriteRow[] | null) ?? [])
            .map<FavoriteWithMaybeProduct>((fav) => ({
                id: fav.id,
                user_id: fav.user_id,
                product_id: fav.product_id,
                created_at: fav.created_at,
                product: transformProductForFavorite(fav.products, discountMap.get(fav.products?.id))
            }))
            .filter((fav): fav is FavoriteWithProduct => !!fav.product);

        return { favorites, error: null };
    } catch (error) {
        console.error("Error in getUserFavorites:", error);
        return { favorites: [], error: error as Error };
    }
}

function transformProductForFavorite(product: any, discount?: { discount_percent: number } | null) {
    if (!product) return null;

    const { rating, reviewCount } = calculateReviewStats(product.reviews);
    const imageUrl = getProductImageUrl(product) || FALLBACK_IMAGE_URL;
    const normalizedPrice = Number(product.base_price ?? 0);
    const discountPercent = discount?.discount_percent || undefined;

    return {
        id: product.id,
        name: product.name,
        title: product.name,
        slug: product.slug,
        base_price: normalizedPrice,
        price_cents: normalizedPrice,
        currency: DEFAULT_CURRENCY,
        image_url: imageUrl,
        product_images: product.product_images || [],
        stock: null,
        rating,
        review_count: reviewCount,
        discount_percent: discountPercent,
    };
}

function calculateReviewStats(reviews?: Array<{ rating?: number | null }>) {
    if (!reviews || reviews.length === 0) {
        return { rating: 0, reviewCount: 0 };
    }

    const ratedReviews = reviews.filter(
        (review) => typeof review?.rating === "number" && !Number.isNaN(Number(review.rating))
    );

    if (ratedReviews.length === 0) {
        return { rating: 0, reviewCount: 0 };
    }

    const total = ratedReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    const average = Number((total / ratedReviews.length).toFixed(1));

    return {
        rating: average,
        reviewCount: ratedReviews.length,
    };
}

/**
 * Check if a product is in user's favorites
 */
export async function isProductFavorited(userId: string, productId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from("user_favorites")
            .select("id")
            .eq("user_id", userId)
            .eq("product_id", productId)
            .maybeSingle(); // Returns null if not found, no error

        if (error) {
            console.error("Error checking if favorited:", error);
            return false;
        }

        return !!data;
    } catch (error) {
        console.error("Error in isProductFavorited:", error);
        return false;
    }
}

/**
 * Get favorite count for a specific product
 */
export async function getProductFavoriteCount(productId: string): Promise<number> {
    try {
        const { count, error } = await supabase
            .from("user_favorites")
            .select("*", { count: "exact", head: true })
            .eq("product_id", productId);

        if (error) {
            console.error("Error getting favorite count:", error);
            return 0;
        }

        return count || 0;
    } catch (error) {
        console.error("Error in getProductFavoriteCount:", error);
        return 0;
    }
}

