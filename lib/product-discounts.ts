/**
 * Product Discounts Utility Functions
 * Helper functions for working with product_discounts table
 */

import supabase from '@/lib/supabaseClient';

export interface ProductDiscount {
    id: string;
    product_id: string;
    discount_percent: number;
    starts_at?: string | null;
    ends_at?: string | null;
    active: boolean;
    created_at?: string;
    updated_at?: string;
}

/**
 * Get active discount for a product
 * Returns the most recent active discount that is currently valid
 */
export async function getActiveProductDiscount(productId: string): Promise<ProductDiscount | null> {
    const { data, error } = await supabase
        .from('product_discounts')
        .select('*')
        .eq('product_id', productId)
        .eq('active', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching product discount:', error);
        return null;
    }

    if (!data || data.length === 0) {
        return null;
    }

    // Filter to find the first valid discount
    const validDiscount = data.find(isDiscountValid);
    return validDiscount || null;
}

/**
 * Get active discount percentage for a product (0 if no discount)
 */
export async function getProductDiscountPercent(productId: string): Promise<number> {
    const discount = await getActiveProductDiscount(productId);
    return discount?.discount_percent || 0;
}

/**
 * Check if a discount is currently valid (within date range and active)
 */
export function isDiscountValid(discount: ProductDiscount | null): boolean {
    if (!discount || !discount.active) {
        return false;
    }

    const now = new Date();

    // Check start date
    if (discount.starts_at) {
        const startsAt = new Date(discount.starts_at);
        if (now < startsAt) {
            return false;
        }
    }

    // Check end date
    if (discount.ends_at) {
        const endsAt = new Date(discount.ends_at);
        if (now > endsAt) {
            return false;
        }
    }

    return true;
}

/**
 * Calculate discounted price
 */
export function calculateDiscountedPrice(basePrice: number, discountPercent: number): number {
    if (discountPercent <= 0 || discountPercent > 100) {
        return basePrice;
    }
    return basePrice * (1 - discountPercent / 100);
}

/**
 * Get active discounts for multiple products (batch query)
 */
export async function getActiveProductDiscounts(productIds: string[]): Promise<Map<string, ProductDiscount>> {
    if (productIds.length === 0) {
        return new Map();
    }

    const { data, error } = await supabase
        .from('product_discounts')
        .select('*')
        .in('product_id', productIds)
        .eq('active', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching product discounts:', error);
        return new Map();
    }

    // Group by product_id and take the most recent valid discount for each
    const discountMap = new Map<string, ProductDiscount>();
    
    if (data) {
        // Filter valid discounts
        const validDiscounts = data.filter(isDiscountValid);
        
        // Get most recent discount per product
        validDiscounts.forEach((discount) => {
            const existing = discountMap.get(discount.product_id);
            if (!existing || new Date(discount.created_at || 0) > new Date(existing.created_at || 0)) {
                discountMap.set(discount.product_id, discount);
            }
        });
    }

    return discountMap;
}

