# Shipping Rates Setup Guide

## Overview
This guide will help you set up dynamic shipping rates in your Supabase database.

## Step 1: Create the Shipping Rates Table

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `create-shipping-rates-table.sql`
4. Click **Run** to execute the SQL

This will create:
- `shipping_rates` table with all necessary columns
- Default shipping rates for Tunisia, Algeria, Morocco, Libya, and Egypt
- Indexes for performance
- Row Level Security (RLS) policies
- Auto-update timestamp trigger

## Step 2: Verify the Table

```sql
SELECT * FROM shipping_rates ORDER BY display_order;
```

You should see shipping rates for all countries with both standard and express methods.

## Step 3: Update Your Code

The shipping calculation is already implemented in `lib/shipping.ts`. You need to update your checkout page to use it.

### In `app/[locale]/checkout/page.tsx`:

Replace the hardcoded shipping cost:
```typescript
const shippingCost = 7; // OLD
```

With dynamic calculation:
```typescript
const [shippingCost, setShippingCost] = useState(7);
const [shippingRate, setShippingRate] = useState<ShippingRate | null>(null);

// Calculate shipping when country or subtotal changes
useEffect(() => {
    async function fetchShipping() {
        const countryCode = getCountryCode(formData.country); // TN for Tunisia, etc.
        const { cost, isFree, rate } = await calculateShipping(
            countryCode,
            subtotal,
            'standard' // or let user select method
        );
        setShippingCost(cost);
        setShippingRate(rate);
    }
    
    if (formData.country) {
        fetchShipping();
    }
}, [formData.country, subtotal]);
```

## Step 4: Test the Shipping Calculation

1. Add products to cart
2. Go to checkout
3. Select different countries in the form
4. Verify shipping cost changes based on country
5. Try reaching free shipping threshold

## Features Implemented

### 1. Country-Specific Rates
- Each country has different base rates
- Tunisia: 7 TND (standard), 12 TND (express)
- Algeria/Morocco: 15 TND (standard), 25 TND (express)
- Libya: 20 TND (standard), 35 TND (express)
- Egypt: 18 TND (standard), 30 TND (express)

### 2. Free Shipping Thresholds
- Tunisia: Free over 100 TND
- Algeria/Morocco: Free over 150 TND
- Libya: Free over 200 TND
- Egypt: Free over 180 TND

### 3. Shipping Methods
- **Standard**: 2-5 days depending on country
- **Express**: 1-4 days depending on country

### 4. Admin Flexibility
Update rates anytime without code changes:
```sql
UPDATE shipping_rates 
SET base_rate = 8.00 
WHERE country_code = 'TN' AND shipping_method = 'standard';
```

## Advanced: Add New Country

```sql
INSERT INTO shipping_rates (
    country, 
    country_code, 
    shipping_method, 
    base_rate, 
    free_shipping_threshold, 
    estimated_days_min, 
    estimated_days_max
) VALUES 
('New Country', 'NC', 'standard', 10.00, 120.00, 3, 5),
('New Country', 'NC', 'express', 20.00, NULL, 1, 3);
```

## Benefits

✅ **Dynamic pricing** - Change rates without deployment
✅ **Multi-region support** - Different rates per country
✅ **Free shipping** - Automatic calculation with thresholds
✅ **Multiple methods** - Standard, Express, etc.
✅ **Performance** - Cached and indexed for fast lookups
✅ **Secure** - RLS policies protect data
✅ **Scalable** - Easy to add new countries/methods

## Helper Function: Country Code Mapping

Add this to your checkout page:
```typescript
function getCountryCode(countryName: string): string {
    const mapping: Record<string, string> = {
        'Tunisia': 'TN',
        'Algeria': 'DZ',
        'Morocco': 'MA',
        'Libya': 'LY',
        'Egypt': 'EG'
    };
    return mapping[countryName] || 'TN';
}
```

## Monitoring

Track shipping costs in your orders:
```sql
SELECT 
    country,
    AVG(shipping_cost) as avg_shipping,
    COUNT(*) as order_count,
    COUNT(CASE WHEN shipping_cost = 0 THEN 1 END) as free_shipping_count
FROM orders
GROUP BY country
ORDER BY order_count DESC;
```

