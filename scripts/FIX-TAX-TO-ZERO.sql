-- ============================================
-- SET TAX TO 0% - COMPLETE FIX
-- ============================================

-- This will set Tunisia (and all countries) to 0% tax
-- Run ALL these commands in Supabase SQL Editor

-- 1. Update TUNISIA specifically to 0%
UPDATE country_tax_rates 
SET tax_rate = 0.00,
    description = 'Tax-free / Exonéré de taxe',
    updated_at = NOW()
WHERE country_code = 'TN';

-- 2. Update ALL countries to 0% (optional - if you want all countries tax-free)
UPDATE country_tax_rates 
SET tax_rate = 0.00,
    description = 'Tax-free / Exonéré de taxe',
    updated_at = NOW()
WHERE is_active = true;

-- 3. Update global fallback to 0% (for countries not in the table)
UPDATE site_settings 
SET setting_value = '0',
    updated_at = NOW()
WHERE setting_key = 'general_tax_rate';

-- 4. Verify the changes - Tunisia should show 0%
SELECT 
    country,
    country_code,
    tax_rate,
    CONCAT(ROUND(tax_rate * 100, 0), '%') as tax_percentage,
    description,
    updated_at
FROM country_tax_rates
WHERE country_code = 'TN';

-- 5. Verify all countries
SELECT 
    country,
    country_code,
    tax_rate,
    CONCAT(ROUND(tax_rate * 100, 0), '%') as tax_percentage
FROM country_tax_rates
WHERE is_active = true
ORDER BY country;

-- 6. Verify global setting
SELECT 
    setting_key,
    setting_value,
    CONCAT(ROUND(CAST(setting_value AS DECIMAL) * 100, 0), '%') as percentage,
    updated_at
FROM site_settings
WHERE setting_key = 'general_tax_rate';

-- ============================================
-- EXPECTED RESULTS AFTER RUNNING:
-- Tunisia: 0%
-- All countries: 0%
-- Global fallback: 0%
-- ============================================

-- ============================================
-- TO RESTORE TO 19% LATER:
-- ============================================

-- Restore Tunisia to 19%
-- UPDATE country_tax_rates 
-- SET tax_rate = 0.19,
--     description = 'TVA 19% - Taux standard',
--     updated_at = NOW()
-- WHERE country_code = 'TN';

-- Restore global to 19%
-- UPDATE site_settings 
-- SET setting_value = '0.19',
--     updated_at = NOW()
-- WHERE setting_key = 'general_tax_rate';

