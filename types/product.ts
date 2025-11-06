// Shared product interfaces

export interface Product {
    id: string;
    title: string;
    slug: string;
    description: string;
    price_cents: number;
    currency: string;
    image_url: string;
    images?: Array<{
        id?: string;
        url: string;
        alt?: string;
    }>;
    category_id: string;
    rating: number;
    review_count: number;
    stock: number;
    is_featured: boolean;
    discount_percent?: number;
}

export interface PromoProduct {
    id: string;
    title: string;
    slug: string;
    price_cents: number;
    currency: string;
    image_url: string;
    discount_percent?: number;
    sold_count: number;
    stock: number;
    promo_end_date: string | null; // ISO date string from database
    category_id?: string;
}

