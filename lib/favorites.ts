import supabase from "./supabaseClient";

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
        stock: number;
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
                    title,
                    slug,
                    price_cents,
                    currency,
                    image_url,
                    stock,
                    rating,
                    review_count,
                    discount_percent
                )
            `)
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching favorites:", error);
            return { favorites: [], error };
        }

        // Transform the data to match our interface
        const favorites: FavoriteWithProduct[] = (data || []).map((fav: any) => ({
            id: fav.id,
            user_id: fav.user_id,
            product_id: fav.product_id,
            created_at: fav.created_at,
            product: fav.products
        }));

        return { favorites, error: null };
    } catch (error) {
        console.error("Error in getUserFavorites:", error);
        return { favorites: [], error: error as Error };
    }
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

