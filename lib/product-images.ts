/**
 * Product Images Utility Functions
 * Helper functions for working with product_images table
 */

import supabase from '@/lib/supabaseClient';

export interface ProductImage {
    id: string;
    product_id: string;
    variant_id?: string | null;
    image_url: string;
    alt_text?: string | null;
    is_main: boolean;
    position: number;
    created_at?: string;
    updated_at?: string;
}

/**
 * Get all images for a product
 */
export async function getProductImages(productId: string): Promise<ProductImage[]> {
    const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productId)
        .is('variant_id', null) // Only product-level images
        .order('position', { ascending: true })
        .order('is_main', { ascending: false });

    if (error) {
        console.error('Error fetching product images:', error);
        return [];
    }

    return data || [];
}

/**
 * Get main images for a product (is_main = true)
 */
export async function getMainProductImages(productId: string): Promise<ProductImage[]> {
    const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productId)
        .is('variant_id', null)
        .eq('is_main', true)
        .order('position', { ascending: true });

    if (error) {
        console.error('Error fetching main product images:', error);
        return [];
    }

    return data || [];
}

/**
 * Get primary image (first main image or first image)
 */
export async function getPrimaryProductImage(productId: string): Promise<string | null> {
    const images = await getProductImages(productId);

    // Try to find a main image first
    const mainImage = images.find(img => img.is_main);
    if (mainImage) {
        return mainImage.image_url;
    }

    // Fallback to first image
    if (images.length > 0) {
        return images[0].image_url;
    }

    return null;
}

/**
 * Get images for a variant
 */
export async function getVariantImages(variantId: string): Promise<ProductImage[]> {
    const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('variant_id', variantId)
        .order('position', { ascending: true });

    if (error) {
        console.error('Error fetching variant images:', error);
        return [];
    }

    return data || [];
}

/**
 * Get primary image for a variant (or fallback to product image)
 */
export async function getVariantPrimaryImage(
    variantId: string,
    productId: string
): Promise<string | null> {
    // Try variant images first
    const variantImages = await getVariantImages(variantId);
    if (variantImages.length > 0) {
        return variantImages[0].image_url;
    }

    // Fallback to product images
    return await getPrimaryProductImage(productId);
}

/**
 * Helper to get image URL from product (with fallback)
 */
export function getProductImageUrl(product: {
    product_images?: ProductImage[];
    images?: ProductImage[];
    image_url?: string; // Legacy fallback
}): string | null {
    // Try product_images first (new schema)
    if (product.product_images && product.product_images.length > 0) {
        const mainImage = product.product_images.find(img => img.is_main);
        return mainImage ? mainImage.image_url : product.product_images[0].image_url;
    }

    // Try images alias (backward compatibility)
    if (product.images && product.images.length > 0) {
        const mainImage = product.images.find(img => img.is_main);
        return mainImage ? mainImage.image_url : product.images[0].image_url;
    }

    // Legacy fallback
    if (product.image_url) {
        return product.image_url;
    }

    return null;
}

/**
 * Get all images for a product (including variant images)
 */
export function getAllProductImages(product: {
    product_images?: ProductImage[];
    images?: ProductImage[];
    variants?: Array<{
        id: string;
        product_images?: ProductImage[];
    }>;
}): ProductImage[] {
    const images: ProductImage[] = [];

    // Add product-level images
    if (product.product_images) {
        images.push(...product.product_images);
    } else if (product.images) {
        images.push(...product.images);
    }

    // Add variant images if needed
    if (product.variants) {
        product.variants.forEach(variant => {
            if (variant.product_images) {
                images.push(...variant.product_images);
            }
        });
    }

    return images.sort((a, b) => a.position - b.position);
}

