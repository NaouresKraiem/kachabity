// Shared utility functions for products
// Use these instead of repeating code across components

/**
 * Get product name based on locale
 */
export function getProductName(product: any, locale: string): string {
    if (locale === 'ar' && product.name_ar) {
        return product.name_ar;
    }
    if (locale === 'fr' && product.name_fr) {
        return product.name_fr;
    }
    return product.name || '';
}

/**
 * Get product description based on locale
 */
export function getProductDescription(product: any, locale: string): string {
    if (locale === 'ar' && product.description_ar) {
        return product.description_ar;
    }
    if (locale === 'fr' && product.description_fr) {
        return product.description_fr;
    }
    return product.description || '';
}

/**
 * Get category name based on locale
 */
export function getCategoryName(category: any, locale: string): string {
    if (locale === 'ar' && category.name_ar) {
        return category.name_ar;
    }
    if (locale === 'fr' && category.name_fr) {
        return category.name_fr;
    }
    return category.name || '';
}

/**
 * Get main image URL from product
 */
export function getProductImageUrl(product: any): string | null {
    // Try product_images first (new schema)
    if (product.product_images && product.product_images.length > 0) {
        const mainImage = product.product_images.find((img: any) => img.is_main);
        return mainImage ? mainImage.image_url : product.product_images[0].image_url;
    }

    // Try images alias (backward compatibility)
    if (product.images && product.images.length > 0) {
        const mainImage = product.images.find((img: any) => img.is_main);
        return mainImage ? mainImage.image_url : product.images[0].image_url;
    }

    // Legacy fallback
    if (product.image_url) {
        return product.image_url;
    }

    return null;
}

/**
 * Calculate discounted price
 */
export function calculateDiscountedPrice(
    basePrice: number,
    discountPercent?: number
): {
    originalPrice: number;
    finalPrice: number;
    savings: number;
    hasDiscount: boolean;
} {
    if (!discountPercent || discountPercent <= 0) {
        return {
            originalPrice: basePrice,
            finalPrice: basePrice,
            savings: 0,
            hasDiscount: false
        };
    }

    const finalPrice = basePrice * (1 - discountPercent / 100);
    return {
        originalPrice: basePrice,
        finalPrice: Math.round(finalPrice),
        savings: Math.round(basePrice - finalPrice),
        hasDiscount: true
    };
}

/**
 * Check if product is in stock
 */
export function isProductInStock(product: any): boolean {
    return product.stock_quantity > 0;
}

/**
 * Get stock status
 */
export function getStockStatus(stockQuantity: number): {
    status: 'in_stock' | 'low_stock' | 'out_of_stock';
    label: string;
} {
    if (stockQuantity <= 0) {
        return { status: 'out_of_stock', label: 'Out of Stock' };
    }
    if (stockQuantity < 5) {
        return { status: 'low_stock', label: 'Low Stock' };
    }
    return { status: 'in_stock', label: 'In Stock' };
}

/**
 * Format product URL
 */
export function getProductUrl(product: any, categorySlug?: string, locale: string = 'en'): string {
    const slug = product.slug || product.id;
    const category = categorySlug || product.category?.slug || 'all';
    return `/${locale}/products/${category}/${slug}`;
}

/**
 * Get sorted product images
 */
export function getSortedProductImages(product: any): Array<{
    url: string;
    alt: string;
    isMain: boolean;
}> {
    if (!product.product_images || product.product_images.length === 0) {
        return [];
    }

    return [...product.product_images]
        .sort((a, b) => a.position - b.position)
        .map(img => ({
            url: img.image_url,
            alt: img.alt || product.name,
            isMain: img.is_main || false
        }));
}

