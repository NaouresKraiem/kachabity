-- ============================================
-- DEBUG: WHY AM I STILL SEEING 19% TAX?
-- ============================================

-- Run these queries to find out what's wrong

-- 1. Check Tunisia tax rate in country_tax_rates table
SELECT 
    '1. Tunisia Tax Rate' as step,
    country,
    country_code,
    tax_rate,
    CONCAT(ROUND(tax_rate * 100, 0), '%') as tax_percentage,
    description,
    is_active,
    updated_at
FROM country_tax_rates
WHERE country_code = 'TN';

-- Expected: tax_rate should be 0.00
-- If it shows 0.19, that's your problem!

-- 2. Check global fallback rate
SELECT 
    '2. Global Fallback Rate' as step,
    setting_key,
    setting_value,
    CONCAT(ROUND(CAST(setting_value AS DECIMAL) * 100, 0), '%') as percentage,
    updated_at
FROM site_settings
WHERE setting_key = 'general_tax_rate';

-- Expected: setting_value should be '0' or '0.00'
-- If it shows '0.19', that's your problem!

-- 3. Check all country tax rates
SELECT 
    '3. All Countries' as step,
    country,
    country_code,
    tax_rate,
    CONCAT(ROUND(tax_rate * 100, 0), '%') as tax_percentage,
    is_active
FROM country_tax_rates
ORDER BY country;

-- 4. Check if Tunisia row exists at all
SELECT 
    '4. Tunisia Exists?' as step,
    CASE 
        WHEN EXISTS (SELECT 1 FROM country_tax_rates WHERE country_code = 'TN') 
        THEN 'YES - Tunisia found in table'
        ELSE 'NO - Tunisia NOT in table (will use global rate)'
    END as status;

-- ============================================
-- INTERPRETATION OF RESULTS:
-- ============================================

-- SCENARIO 1: Tunisia tax_rate = 0.19
-- → You only updated global_tax_rate, not Tunisia specifically
-- → SOLUTION: Run FIX-TAX-TO-ZERO.sql command #1

-- SCENARIO 2: Tunisia tax_rate = 0.00 but still showing 19%
-- → Browser cache or 5-minute server cache
-- → SOLUTION: 
--   - Wait 5 minutes
--   - Or hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
--   - Or restart Next.js dev server

-- SCENARIO 3: Tunisia not in table at all
-- → Using global fallback
-- → Check if global is set to 0
-- → SOLUTION: Run FIX-TAX-TO-ZERO.sql command #3

-- ============================================

