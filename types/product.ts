// Shared product interfaces

export interface Size {
    id: string;
    name: string; // e.g., "S", "M", "L", "XL"
    display_name?: string; // e.g., "Small", "Medium", "Large"
    sort_order?: number;
    description?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Color {
    id: string;
    name: string; // e.g., "Red", "Blue", "Navy Blue"
    hex_code?: string; // e.g., "#FF0000"
    rgb_code?: string; // e.g., "rgb(255,0,0)"
    display_name?: string;
    sort_order?: number;
    description?: string;
    created_at?: string;
    updated_at?: string;
}

export interface ProductVariant {
    id: string;
    product_id: string;
    // New normalized references (preferred)
    size_id?: string | null; // Foreign key to sizes table
    color_id?: string | null; // Foreign key to colors table
    // Related data (from joins - populated when fetching with relations)
    size?: Size; // Size object when joined via size_id
    color?: Color; // Color object when joined via color_id
    // Legacy fields (for backward compatibility during migration)
    // These will be removed after migration is complete
    color_text?: string; // Legacy: Color name or hex code (deprecated - use color_id + color join)
    size_text?: string; // Legacy: Size (S, M, L, XL, etc.) (deprecated - use size_id + size join)
    // Other fields
    sku?: string; // Stock Keeping Unit
    price?: number; // Optional variant-specific price (in currency units, not cents)
    stock: number; // Stock for this variant
    images?: Array<{
        id?: string;
        url: string;
        alt?: string;
    }>;
    image_url?: string; // Primary image for this variant (deprecated - use product_images)
    is_available?: boolean; // Whether this variant is available (preferred)
    is_active?: boolean; // Legacy field (deprecated - use is_available)
    deleted_at?: string | null; // Soft delete timestamp
    created_at?: string;
    updated_at?: string;
}

export interface Product {
    id: string;
    name: string; // Changed from 'title'
    slug: string;
    description: string | null;
    category_id: string | null;
    base_price: number; // Changed from 'price_cents' - now in currency units
    status: 'active' | 'inactive' | 'archived';
    default_variant_id?: string | null; // Optional reference to default/primary variant
    deleted_at: string | null; // Soft delete
    created_at: string;
    updated_at: string;
    // Related data (from joins)
    categories?: {
        name: string;
        slug: string;
    };
    variants?: ProductVariant[]; // Product variants with different colors/sizes
    default_variant?: ProductVariant; // Default variant when joined
    // Images come from product_images table (not stored in products table)
    product_images?: Array<{
        id: string;
        product_id: string;
        variant_id?: string | null;
        image_url: string;
        alt_text?: string | null;
        is_main: boolean;
        position: number;
        created_at?: string;
        updated_at?: string;
    }>;
    // Legacy alias for backward compatibility
    images?: Array<{
        id: string;
        product_id: string;
        variant_id?: string | null;
        image_url: string;
        alt_text?: string | null;
        is_main: boolean;
        position: number;
    }>;
}

// PromoProduct interface for promotional products
export interface PromoProduct {
    id: string;
    name: string;
    title?: string; // Alias for name (for backward compatibility)
    slug: string;
    base_price: number;
    price_cents?: number; // Alias for base_price (for backward compatibility)
    image_url?: string; // Should come from product_images table
    category_id?: string;
    currency?: string;
    discount_percent?: number; // From product_discounts table
    sold_count?: number;
    stock?: number;
    promo_end_date?: string; // From product_discounts.ends_at
    rating?: number;
    review_count?: number;
}

