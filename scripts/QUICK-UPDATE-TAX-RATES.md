# 🎯 Quick Guide: Update Tax Rates

You have **full control** to change tax rates anytime without touching code!

---

## 📊 Two Levels of Tax Control

### 1. **Country-Specific Tax Rates** (Recommended)
Each country can have its own tax rate.

### 2. **Global Fallback Rate**
Used when a country is not found in the table.

---

## 🚀 Method 1: Via Supabase Dashboard (Easiest)

### Change Tunisia Tax to 0%:

1. Go to **Supabase Dashboard**
2. Navigate to: **Table Editor** → `country_tax_rates`
3. Find **Tunisia** row
4. Change `tax_rate` from `0.19` to `0.00`
5. Click **Save**

✅ **Done!** Tax is now 0% for Tunisia

### Change Tunisia Tax to 19%:

Same steps, but set `tax_rate` to `0.19`

---

## 💻 Method 2: Via SQL Commands

### Set Tunisia Tax to 0%:

```sql
UPDATE country_tax_rates 
SET tax_rate = 0.00,
    description = 'No tax applied'
WHERE country_code = 'TN';
```

### Set Tunisia Tax to 19%:

```sql
UPDATE country_tax_rates 
SET tax_rate = 0.19,
    description = 'TVA 19% - Standard rate'
WHERE country_code = 'TN';
```

### Set Tunisia Tax to any rate (e.g., 7%):

```sql
UPDATE country_tax_rates 
SET tax_rate = 0.07,
    description = 'TVA 7% - Reduced rate'
WHERE country_code = 'TN';
```

---

## 🌍 Update Multiple Countries at Once

### Set all countries to 0%:

```sql
UPDATE country_tax_rates 
SET tax_rate = 0.00,
    description = 'Tax-free promotion'
WHERE is_active = true;
```

### Set specific countries:

```sql
-- Tunisia and Algeria to 15%
UPDATE country_tax_rates 
SET tax_rate = 0.15
WHERE country_code IN ('TN', 'DZ');

-- Morocco to 20%, Egypt to 14%
UPDATE country_tax_rates 
SET tax_rate = 0.20 WHERE country_code = 'MA';
UPDATE country_tax_rates 
SET tax_rate = 0.14 WHERE country_code = 'EG';
```

---

## 🔧 Update Global Fallback Rate

If a country is not in the `country_tax_rates` table, it uses the global rate.

### Set global tax to 0%:

```sql
UPDATE site_settings 
SET setting_value = '0'
WHERE setting_key = 'general_tax_rate';
```

### Set global tax to 19%:

```sql
UPDATE site_settings 
SET setting_value = '0.19'
WHERE setting_key = 'general_tax_rate';
```

---

## ⚡ Quick Examples

### Example 1: Black Friday - 0% Tax Everywhere

```sql
-- Option A: Disable tax for all countries
UPDATE country_tax_rates SET tax_rate = 0.00;

-- Option B: Disable global fallback
UPDATE site_settings 
SET setting_value = '0'
WHERE setting_key = 'general_tax_rate';
```

### Example 2: Tunisia Promotion - 0% Tax

```sql
UPDATE country_tax_rates 
SET tax_rate = 0.00
WHERE country_code = 'TN';
```

### Example 3: Return to Normal (19% for Tunisia)

```sql
UPDATE country_tax_rates 
SET tax_rate = 0.19
WHERE country_code = 'TN';
```

---

## 📋 Current Tax Rates Table

| Country  | Code | Current Rate | Command to Change |
|----------|------|--------------|-------------------|
| Tunisia  | TN   | 19% (0.19)   | `WHERE country_code = 'TN'` |
| Algeria  | DZ   | 19% (0.19)   | `WHERE country_code = 'DZ'` |
| Morocco  | MA   | 20% (0.20)   | `WHERE country_code = 'MA'` |
| Libya    | LY   | 0% (0.00)    | `WHERE country_code = 'LY'` |
| Egypt    | EG   | 14% (0.14)   | `WHERE country_code = 'EG'` |

---

## 🎯 Common Use Cases

### Use Case 1: Temporary Tax-Free Promotion (1 week)

**Start Promotion:**
```sql
UPDATE country_tax_rates SET tax_rate = 0.00 WHERE country_code = 'TN';
```

**End Promotion (restore to 19%):**
```sql
UPDATE country_tax_rates SET tax_rate = 0.19 WHERE country_code = 'TN';
```

### Use Case 2: Different Tax for Different Products (Future)

You could add a `product_category` column to have different taxes per category:
- Food: 7%
- Electronics: 19%
- Books: 0%

---

## 🔄 How Fast Do Changes Apply?

- **Cache Duration**: 5 minutes
- **Changes reflect**: Within 5 minutes maximum
- **Force immediate update**: Restart your Next.js server (in production)

---

## 🧪 Test Your Changes

1. Update the tax rate in Supabase
2. Go to checkout page
3. Select the country you changed
4. Verify the tax percentage displays correctly
5. Check the calculation is correct

**Example Test:**
```
Cart: 100 TND
Tax Rate: 0% 
Expected Tax: 0.00 TND ✅
Display: "Tax (0%): 0.00 TND"

Cart: 100 TND
Tax Rate: 19%
Expected Tax: 19.00 TND ✅
Display: "Tax (19%): 19.00 TND"
```

---

## 📊 View All Current Tax Rates

### Via SQL:
```sql
SELECT country, country_code, tax_rate, tax_name, description
FROM country_tax_rates
WHERE is_active = true
ORDER BY country;
```

### Via Supabase Dashboard:
1. Go to **Table Editor**
2. Select `country_tax_rates` table
3. View all rows

---

## 🚨 Important Notes

1. **Decimal Format**: 
   - ✅ Correct: `0.19` (means 19%)
   - ❌ Wrong: `19` (means 1900%!)

2. **Range**:
   - `0.00` = 0%
   - `0.19` = 19%
   - `1.00` = 100%

3. **Changes are immediate** (after 5-minute cache)

4. **No code deployment needed** - just update database

5. **Backup** your rates before major changes:
   ```sql
   SELECT * FROM country_tax_rates;
   -- Save the output somewhere
   ```

---

## 🎯 Most Common Actions

### Make Tunisia Tax-Free (0%):
```sql
UPDATE country_tax_rates SET tax_rate = 0.00 WHERE country_code = 'TN';
```

### Restore Tunisia to 19%:
```sql
UPDATE country_tax_rates SET tax_rate = 0.19 WHERE country_code = 'TN';
```

### Set custom rate (e.g., 13%):
```sql
UPDATE country_tax_rates SET tax_rate = 0.13 WHERE country_code = 'TN';
```

---

## 📞 Need Help?

- Check `country_tax_rates` table in Supabase
- Verify `tax_rate` column (should be decimal: 0.19 not 19)
- Check console logs in browser for current tax rate
- Ensure country code is correct ('TN' for Tunisia)

---

## ✅ Summary

✅ You can change tax rates **anytime**  
✅ No code changes required  
✅ Changes via **Supabase Dashboard** or **SQL**  
✅ Per-country rates **or** global fallback  
✅ Updates automatically (5-min cache)  
✅ 0% to 100% range supported  

**You have full control!** 🎉

