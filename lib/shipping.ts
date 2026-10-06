import supabase from '@/lib/supabaseClient';
import { clearSettingsCache, getSiteSettings, type SiteSettings } from './get-site-settings';


export interface ShippingRate {
    id: string;
    country: string;
    country_code: string;
    shipping_method: 'standard' | 'express' | 'overnight';
    base_rate: number;
    free_shipping_threshold: number | null; // NULL means use global threshold
    estimated_days_min: number;
    estimated_days_max: number;
    is_active: boolean;
    display_order: number;
}

const FREE_SHIPPING_STEP = 0.01;

function qualifiesForFreeShipping(subtotal: number, threshold: number): boolean {
    return subtotal > threshold;
}

function amountNeededForFreeShipping(subtotal: number, threshold: number): number {
    return Math.max(0, Number((threshold + FREE_SHIPPING_STEP - subtotal).toFixed(2)));
}

/**
 * Map a checkout country name to the code used by shipping_rates and
 * country_tax_rates. Unknown countries fall back to Tunisia.
 */
export function getCountryCode(countryName: string): string {
    const mapping: Record<string, string> = {
        'Tunisia': 'TN',
        'Algeria': 'DZ',
        'Morocco': 'MA',
        'Libya': 'LY',
        'Egypt': 'EG'
    };
    return mapping[countryName] || 'TN';
}

/**
 * Get global shipping settings from site_settings table
 */
async function getShippingSettings(): Promise<SiteSettings> {
    return getSiteSettings();
}

/**
 * Get all active shipping rates for a country
 */
export async function getShippingRates(countryCode: string): Promise<{ rates: ShippingRate[] | null; error: Error | null }> {
    try {
        const { data, error } = await supabase
            .from('shipping_rates')
            .select('*')
            .eq('country_code', countryCode)
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) {
            console.error('Error fetching shipping rates:', error);
            return { rates: null, error };
        }

        return { rates: data, error: null };
    } catch (error) {
        console.error('Error in getShippingRates:', error);
        return { rates: null, error: error as Error };
    }
}

/**
 * Calculate shipping cost for an order
 * Uses global free shipping threshold unless country has specific override
 */
export async function calculateShipping(
    countryCode: string,
    subtotal: number,
    shippingMethod: 'standard' | 'express' | 'overnight' = 'standard'
): Promise<{ cost: number; isFree: boolean; rate: ShippingRate | null; amountNeeded: number; threshold: number; error: Error | null }> {
    try {
        // Get global settings
        const settings = await getShippingSettings();

        // Get country-specific rate
        const { data, error } = await supabase
            .from('shipping_rates')
            .select('*')
            .eq('country_code', countryCode)
            .eq('shipping_method', shippingMethod)
            .eq('is_active', true)
            .single();

        if (error || !data) {
            console.error('Error fetching shipping rate:', error);
            // Fallback to default settings
            const isFree = settings.free_shipping_enabled && qualifiesForFreeShipping(subtotal, settings.global_free_shipping_threshold);
            const cost = isFree ? 0 : settings.default_shipping_cost;
            const amountNeeded = isFree ? 0 : amountNeededForFreeShipping(subtotal, settings.global_free_shipping_threshold);

            return {
                cost,
                isFree,
                rate: null,
                amountNeeded,
                threshold: settings.global_free_shipping_threshold,
                error
            };
        }

        // Determine which threshold to use:
        // 1. If country has specific threshold, use it
        // 2. Otherwise, use global threshold
        const threshold = data.free_shipping_threshold ?? settings.global_free_shipping_threshold;

        // Check if order qualifies for free shipping
        const isFree = settings.free_shipping_enabled && qualifiesForFreeShipping(subtotal, threshold);
        const cost = isFree ? 0 : data.base_rate;
        const amountNeeded = isFree ? 0 : amountNeededForFreeShipping(subtotal, threshold);

        return {
            cost,
            isFree,
            rate: data,
            amountNeeded,
            threshold,
            error: null
        };
    } catch (error) {
        console.error('Error in calculateShipping:', error);
        return {
            cost: 8,
            isFree: false,
            rate: null,
            amountNeeded: 300,
            threshold: 300,
            error: error as Error
        };
    }
}

/**
 * Get all active shipping rates (for admin or selection UI)
 */
export async function getAllShippingRates(): Promise<{ rates: ShippingRate[] | null; error: Error | null }> {
    try {
        const { data, error } = await supabase
            .from('shipping_rates')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) {
            console.error('Error fetching all shipping rates:', error);
            return { rates: null, error };
        }

        return { rates: data, error: null };
    } catch (error) {
        console.error('Error in getAllShippingRates:', error);
        return { rates: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
}

/**
 * Get the current global free shipping threshold
 */
export async function getFreeShippingThreshold(): Promise<number> {
    const settings = await getShippingSettings();
    return settings.global_free_shipping_threshold;
}

/**
 * Update the global free shipping threshold
 * This function should be called from admin panel
 */
export async function updateFreeShippingThreshold(newThreshold: number): Promise<{ success: boolean; error: Error | null }> {
    try {
        const { error } = await supabase
            .from('site_settings')
            .update({
                setting_value: newThreshold.toString(),
                updated_at: new Date().toISOString()
            })
            .eq('setting_key', 'global_free_shipping_threshold');

        if (error) {
            console.error('Error updating free shipping threshold:', error);
            return { success: false, error };
        }

        // Clear cache so new value is fetched
        clearSettingsCache();

        return { success: true, error: null };
    } catch (error) {
        console.error('Error in updateFreeShippingThreshold:', error);
        return { success: false, error: error as Error };
    }
}

/**
 * Check if free shipping is available for order amount
 */
export async function checkFreeShippingEligibility(
    subtotal: number,
    countryCode?: string
): Promise<{ isEligible: boolean; amountNeeded: number; threshold: number }> {
    const settings = await getShippingSettings();

    // If country code provided, check for country-specific threshold
    if (countryCode) {
        const { data } = await supabase
            .from('shipping_rates')
            .select('free_shipping_threshold')
            .eq('country_code', countryCode)
            .eq('shipping_method', 'standard')
            .eq('is_active', true)
            .single();

        const threshold = data?.free_shipping_threshold ?? settings.global_free_shipping_threshold;
        const isEligible = settings.free_shipping_enabled && qualifiesForFreeShipping(subtotal, threshold);
        const amountNeeded = isEligible ? 0 : amountNeededForFreeShipping(subtotal, threshold);

        return { isEligible, amountNeeded, threshold };
    }

    // Use global threshold
    const threshold = settings.global_free_shipping_threshold;
    const isEligible = settings.free_shipping_enabled && qualifiesForFreeShipping(subtotal, threshold);
    const amountNeeded = isEligible ? 0 : amountNeededForFreeShipping(subtotal, threshold);

    return { isEligible, amountNeeded, threshold };
}
