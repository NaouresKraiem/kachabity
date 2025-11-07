import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface SiteSettings {
    global_free_shipping_threshold: number;
    free_shipping_enabled: boolean;
    default_shipping_cost: number;
    shipping_tax_rate: number;
    general_tax_rate: number;
}

export interface CountryTaxRate {
    id: string;
    country: string;
    country_code: string;
    tax_rate: number;
    tax_name: string;
    description: string;
    is_active: boolean;
}

interface SiteSettingRow {
    setting_key: string;
    setting_value: string;
}

let cachedSettings: SiteSettings | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get all site settings from database
 */
export async function getSiteSettings(): Promise<SiteSettings> {
    // Return cached settings if still valid
    const now = Date.now();
    if (cachedSettings && (now - cacheTimestamp) < CACHE_DURATION) {
        return cachedSettings;
    }

    try {
        const { data, error } = await supabase
            .from('site_settings')
            .select('setting_key, setting_value')
            .in('setting_key', [
                'global_free_shipping_threshold',
                'free_shipping_enabled',
                'default_shipping_cost',
                'shipping_tax_rate',
                'general_tax_rate'
            ]);

        if (error || !data) {
            console.error('Error fetching site settings:', error);
            // Return defaults
            return {
                global_free_shipping_threshold: 500,
                free_shipping_enabled: true,
                default_shipping_cost: 7,
                shipping_tax_rate: 0,
                general_tax_rate: 0.19
            };
        }

        const settings: SiteSettings = {
            global_free_shipping_threshold: 500,
            free_shipping_enabled: true,
            default_shipping_cost: 7,
            shipping_tax_rate: 0,
            general_tax_rate: 0.19
        };

        data.forEach((row: SiteSettingRow) => {
            const key = row.setting_key as keyof SiteSettings;
            if (key === 'free_shipping_enabled') {
                settings[key] = row.setting_value === 'true';
            } else {
                settings[key] = parseFloat(row.setting_value) || 0;
            }
        });

        // Cache the settings
        cachedSettings = settings;
        cacheTimestamp = now;

        return settings;
    } catch (error) {
        console.error('Error in getSiteSettings:', error);
        return {
            global_free_shipping_threshold: 500,
            free_shipping_enabled: true,
            default_shipping_cost: 7,
            shipping_tax_rate: 0,
            general_tax_rate: 0.19
        };
    }
}

/**
 * Clear the settings cache (call after updating settings)
 */
export function clearSettingsCache() {
    cachedSettings = null;
}

/**
 * Update a site setting
 */
export async function updateSiteSetting(
    key: string,
    value: string | number | boolean
): Promise<{ success: boolean; error: Error | null }> {
    try {
        const stringValue = typeof value === 'boolean' ? value.toString() : value.toString();

        const { error } = await supabase
            .from('site_settings')
            .update({
                setting_value: stringValue,
                updated_at: new Date().toISOString()
            })
            .eq('setting_key', key);

        if (error) {
            console.error('Error updating site setting:', error);
            return { success: false, error };
        }

        // Clear cache so new value is fetched
        clearSettingsCache();

        return { success: true, error: null };
    } catch (error) {
        console.error('Error in updateSiteSetting:', error);
        return { success: false, error: error as Error };
    }
}

/**
 * Get tax rate for a specific country
 * Falls back to general_tax_rate if country-specific rate not found
 */
export async function getCountryTaxRate(countryCode: string): Promise<number> {
    try {
        const { data, error } = await supabase
            .from('country_tax_rates')
            .select('tax_rate')
            .eq('country_code', countryCode)
            .eq('is_active', true)
            .single();

        if (error || !data) {
            // Fall back to general tax rate
            const settings = await getSiteSettings();
            return settings.general_tax_rate;
        }

        return data.tax_rate;
    } catch (error) {
        console.error('Error fetching country tax rate:', error);
        // Fall back to general tax rate
        const settings = await getSiteSettings();
        return settings.general_tax_rate;
    }
}

/**
 * Get all country tax rates
 */
export async function getAllCountryTaxRates(): Promise<CountryTaxRate[]> {
    try {
        const { data, error } = await supabase
            .from('country_tax_rates')
            .select('*')
            .eq('is_active', true)
            .order('country', { ascending: true });

        if (error || !data) {
            console.error('Error fetching country tax rates:', error);
            return [];
        }

        return data as CountryTaxRate[];
    } catch (error) {
        console.error('Error in getAllCountryTaxRates:', error);
        return [];
    }
}

