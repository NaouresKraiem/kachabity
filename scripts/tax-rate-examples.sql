-- ============================================
-- TAX RATE UPDATE EXAMPLES
-- Copy and paste these commands as needed
-- ============================================

-- ============================================
-- TUNISIA TAX RATE CHANGES
-- ============================================

-- Set Tunisia to 0% (tax-free)
UPDATE country_tax_rates 
SET tax_rate = 0.00,
    description = 'Tax-free / Exonéré de taxe'
WHERE country_code = 'TN';

-- Set Tunisia to 19% (standard rate)
UPDATE country_tax_rates 
SET tax_rate = 0.19,
    description = 'TVA 19% - Taux standard'
WHERE country_code = 'TN';

-- Set Tunisia to 7% (reduced rate)
UPDATE country_tax_rates 
SET tax_rate = 0.07,
    description = 'TVA 7% - Taux réduit'
WHERE country_code = 'TN';

-- Set Tunisia to 13% (intermediate rate)
UPDATE country_tax_rates 
SET tax_rate = 0.13,
    description = 'TVA 13% - Taux intermédiaire'
WHERE country_code = 'TN';

-- ============================================
-- ALL COUNTRIES - BULK UPDATES
-- ============================================

-- Set ALL countries to 0% (global promotion)
UPDATE country_tax_rates 
SET tax_rate = 0.00,
    description = 'Promotion - Tax free'
WHERE is_active = true;

-- Set ALL countries to 15%
UPDATE country_tax_rates 
SET tax_rate = 0.15,
    description = 'Special rate 15%'
WHERE is_active = true;

-- ============================================
-- MULTIPLE COUNTRIES AT ONCE
-- ============================================

-- Set Tunisia and Algeria to 0%
UPDATE country_tax_rates 
SET tax_rate = 0.00
WHERE country_code IN ('TN', 'DZ');

-- Set North Africa (except Libya) to 19%
UPDATE country_tax_rates 
SET tax_rate = 0.19
WHERE country_code IN ('TN', 'DZ', 'MA', 'EG');

-- ============================================
-- INDIVIDUAL COUNTRY UPDATES
-- ============================================

-- Algeria to 19%
UPDATE country_tax_rates 
SET tax_rate = 0.19
WHERE country_code = 'DZ';

-- Morocco to 20%
UPDATE country_tax_rates 
SET tax_rate = 0.20
WHERE country_code = 'MA';

-- Egypt to 14%
UPDATE country_tax_rates 
SET tax_rate = 0.14
WHERE country_code = 'EG';

-- Libya to 0% (no VAT)
UPDATE country_tax_rates 
SET tax_rate = 0.00
WHERE country_code = 'LY';

-- ============================================
-- GLOBAL FALLBACK TAX RATE
-- ============================================

-- Set global fallback to 0%
UPDATE site_settings 
SET setting_value = '0'
WHERE setting_key = 'general_tax_rate';

-- Set global fallback to 19%
UPDATE site_settings 
SET setting_value = '0.19'
WHERE setting_key = 'general_tax_rate';

-- Set global fallback to 10%
UPDATE site_settings 
SET setting_value = '0.10'
WHERE setting_key = 'general_tax_rate';

-- ============================================
-- TEMPORARY DISABLE/ENABLE TAX
-- ============================================

-- Disable tax for Tunisia temporarily
UPDATE country_tax_rates 
SET is_active = false
WHERE country_code = 'TN';
-- (Falls back to global rate when disabled)

-- Re-enable tax for Tunisia
UPDATE country_tax_rates 
SET is_active = true
WHERE country_code = 'TN';

-- ============================================
-- VIEW CURRENT TAX RATES
-- ============================================

-- View all active tax rates
SELECT 
    country,
    country_code,
    tax_rate,
    CONCAT(ROUND(tax_rate * 100, 0), '%') as tax_percentage,
    tax_name,
    description,
    is_active
FROM country_tax_rates
WHERE is_active = true
ORDER BY country;

-- View all countries (including inactive)
SELECT 
    country,
    country_code,
    tax_rate,
    CONCAT(ROUND(tax_rate * 100, 0), '%') as tax_percentage,
    is_active
FROM country_tax_rates
ORDER BY country;

-- View global settings
SELECT 
    setting_key,
    setting_value,
    CASE 
        WHEN setting_key = 'general_tax_rate' 
        THEN CONCAT(ROUND(CAST(setting_value AS DECIMAL) * 100, 0), '%')
        ELSE setting_value
    END as display_value,
    description
FROM site_settings
WHERE setting_key IN ('general_tax_rate', 'shipping_tax_rate')
ORDER BY setting_key;

-- ============================================
-- PROMOTIONAL SCENARIOS
-- ============================================

-- BLACK FRIDAY - 0% tax everywhere for 1 week
UPDATE country_tax_rates 
SET tax_rate = 0.00,
    description = 'Black Friday - No tax'
WHERE is_active = true;

-- RESTORE after Black Friday (restore Tunisia to 19%)
UPDATE country_tax_rates 
SET tax_rate = 0.19,
    description = 'TVA 19% - Taux standard'
WHERE country_code = 'TN';

-- RAMADAN SALE - 10% tax instead of 19% (Tunisia)
UPDATE country_tax_rates 
SET tax_rate = 0.10,
    description = 'Ramadan - Reduced tax rate'
WHERE country_code = 'TN';

-- ============================================
-- BACKUP & RESTORE
-- ============================================

-- Create backup (copy current rates)
-- 1. Run this to see current rates:
SELECT * FROM country_tax_rates;
-- 2. Save the output

-- Restore Tunisia to original 19%
UPDATE country_tax_rates 
SET tax_rate = 0.19,
    tax_name = 'TVA',
    description = 'Taxe sur la Valeur Ajoutée - Standard rate for most goods',
    is_active = true
WHERE country_code = 'TN';

-- ============================================
-- ADVANCED: ADD NEW COUNTRY
-- ============================================

-- Add France with 20% VAT
INSERT INTO country_tax_rates (country, country_code, tax_rate, tax_name, description)
VALUES ('France', 'FR', 0.20, 'TVA', 'Taxe sur la Valeur Ajoutée - Taux standard')
ON CONFLICT (country_code) DO UPDATE 
SET tax_rate = EXCLUDED.tax_rate;

-- ============================================
-- TESTING SCENARIOS
-- ============================================

-- Test scenario 1: Set Tunisia to 0% for testing
UPDATE country_tax_rates 
SET tax_rate = 0.00
WHERE country_code = 'TN';

-- Test scenario 2: Set Tunisia to 50% for testing edge cases
UPDATE country_tax_rates 
SET tax_rate = 0.50
WHERE country_code = 'TN';

-- Test scenario 3: Return to normal (19%)
UPDATE country_tax_rates 
SET tax_rate = 0.19
WHERE country_code = 'TN';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if Tunisia tax is 0%
SELECT country, tax_rate, 
       CASE WHEN tax_rate = 0 THEN '✓ Tax is 0%' ELSE '✗ Tax is not 0%' END as status
FROM country_tax_rates
WHERE country_code = 'TN';

-- Check if Tunisia tax is 19%
SELECT country, tax_rate,
       CASE WHEN tax_rate = 0.19 THEN '✓ Tax is 19%' ELSE '✗ Tax is not 19%' END as status
FROM country_tax_rates
WHERE country_code = 'TN';

-- ============================================
-- NOTES
-- ============================================
-- 
-- Tax rates are stored as decimals:
-- - 0.00 = 0%
-- - 0.07 = 7%
-- - 0.13 = 13%
-- - 0.19 = 19%
-- - 1.00 = 100%
--
-- Changes apply within 5 minutes (cache duration)
-- No code deployment needed
-- Updates are immediate in database
-- ============================================

