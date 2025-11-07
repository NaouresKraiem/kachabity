# Country-Specific Tax Rates Setup

This guide explains how to set up and manage country-specific tax rates (VAT/TVA) for your e-commerce platform.

## 🇹🇳 Tunisia Tax Information

**Tunisia uses TVA (Taxe sur la Valeur Ajoutée)**:
- **Standard Rate**: 19% (most goods and services)
- **Reduced Rate**: 13% (some services)  
- **Reduced Rate**: 7% (some goods)

**Current Implementation**: 19% standard rate

---

## 📊 Tax Rates by Country

| Country  | Code | Rate | Tax Name | Notes |
|----------|------|------|----------|-------|
| 🇹🇳 Tunisia | TN   | 19%  | TVA      | Standard rate for most goods |
| 🇩🇿 Algeria | DZ   | 19%  | TVA      | Standard rate |
| 🇲🇦 Morocco | MA   | 20%  | TVA      | Standard rate |
| 🇱🇾 Libya   | LY   | 0%   | N/A      | No VAT system |
| 🇪🇬 Egypt   | EG   | 14%  | VAT      | Standard rate |

---

## 🚀 Database Setup

### 1. Run the SQL Script

Execute in Supabase SQL Editor:

```sql
-- First, update site settings with correct general tax rate
-- This is in: scripts/create-site-settings-shipping.sql
-- (Run this if you haven't already)

-- Then, create country-specific tax rates table
-- This is in: scripts/create-country-tax-rates-table.sql
```

### 2. Verify Tables Created

Check that you have:
- ✅ `site_settings` table with `general_tax_rate = 0.19`
- ✅ `country_tax_rates` table with 5 countries

---

## 🔧 How It Works

### Frontend (Checkout Page)

When a user selects a country, the system automatically:

1. **Fetches country-specific tax rate** from `country_tax_rates` table
2. **Falls back to general rate** if country not found
3. **Updates tax calculation** in real-time

```typescript
// Automatically called when country changes
const countryTaxRate = await getCountryTaxRate('TN'); // Returns 0.19 for Tunisia
setTaxRate(countryTaxRate);

// Tax is calculated as:
const tax = subtotal * taxRate; // e.g., 100 TND * 0.19 = 19 TND
```

### Backend Functions

Located in: `lib/get-site-settings.ts`

```typescript
// Get country-specific tax rate
getCountryTaxRate('TN') // Returns 0.19

// Get all tax rates (for admin panel)
getAllCountryTaxRates() // Returns array of all countries
```

---

## ⚙️ Updating Tax Rates

### Quick Update via Supabase Dashboard

1. Go to: **Table Editor** → `country_tax_rates`
2. Find the country you want to update
3. Edit the `tax_rate` column (use decimal: 0.19 = 19%)
4. Save

### Update via SQL

```sql
-- Change Tunisia tax rate to 20%
UPDATE country_tax_rates 
SET tax_rate = 0.20,
    description = 'Taxe sur la Valeur Ajoutée - Updated rate'
WHERE country_code = 'TN';

-- Change global fallback rate
UPDATE site_settings 
SET setting_value = '0.20'
WHERE setting_key = 'general_tax_rate';
```

### Add a New Country

```sql
INSERT INTO country_tax_rates (country, country_code, tax_rate, tax_name, description)
VALUES ('France', 'FR', 0.20, 'TVA', 'Taxe sur la Valeur Ajoutée - Standard rate');
```

---

## 🧪 Testing

### Test Different Countries in Checkout:

1. **Tunisia (19% TVA)**:
   - Add products worth 100 TND
   - Expected tax: 19 TND
   - See it update when you select Tunisia

2. **Egypt (14% VAT)**:
   - Same 100 TND cart
   - Expected tax: 14 TND
   - Lower tax rate applied

3. **Libya (0% - No VAT)**:
   - Same 100 TND cart
   - Expected tax: 0 TND
   - No tax applied

### Console Logging

The checkout page logs the fetched cost, so you can open DevTools Console to see:

```javascript
// In checkout page
console.log('cost', cost);          // Shipping cost
console.log('tax rate', taxRate);   // Tax rate (e.g., 0.19)
```

---

## 📁 File Structure

```
landing/
├── lib/
│   └── get-site-settings.ts      # Tax rate fetching logic
├── scripts/
│   ├── create-site-settings-shipping.sql  # Global settings (19% default)
│   └── create-country-tax-rates-table.sql # Country-specific rates
└── app/[locale]/checkout/page.tsx         # Frontend implementation
```

---

## ✅ Features

- ✅ **Country-specific tax rates** (Tunisia: 19%, Egypt: 14%, etc.)
- ✅ **Automatic fallback** to global rate if country not found
- ✅ **Real-time updates** when country changes
- ✅ **Database-driven** - easy to update via Supabase
- ✅ **Caching** - efficient performance with 5-minute cache
- ✅ **No code changes needed** to update tax rates

---

## 🔐 Security

- ✅ **Row Level Security (RLS)** enabled on `country_tax_rates`
- ✅ **Public read access** for active rates only
- ✅ **Authenticated write access** for admins
- ✅ **Automatic timestamps** on updates

---

## 🎯 Next Steps

1. **Run both SQL scripts** in Supabase
2. **Test checkout** with different countries
3. **Verify tax calculations** are correct
4. **Update rates** as needed via Supabase dashboard

---

## 📞 Support

If tax calculations seem incorrect:

1. Check `country_tax_rates` table in Supabase
2. Verify the `tax_rate` is in decimal format (0.19 not 19)
3. Check console logs in browser DevTools
4. Ensure country code mapping is correct in checkout page

---

## 🚨 Important Notes

- Tax rates are stored as **decimals** (0.19 = 19%, not 19)
- Default fallback is **19%** (Tunisia standard rate)
- Cache duration is **5 minutes** (rates update automatically)
- Always use **ISO 3166-1 alpha-2** country codes (TN, DZ, MA, etc.)

