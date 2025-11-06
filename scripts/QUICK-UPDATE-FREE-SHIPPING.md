# Quick Guide: Update Free Shipping Threshold

## 🎯 Change Free Shipping Threshold (e.g., from 500 to 600 TND)

### Option 1: Using Supabase Dashboard (Easiest)

1. Go to your Supabase project
2. Navigate to **Table Editor**
3. Select `site_settings` table
4. Find row where `setting_key` = `global_free_shipping_threshold`
5. Change `setting_value` from `500` to your desired amount (e.g., `600`)
6. Click **Save**

✅ Done! Changes take effect immediately (cached for 5 minutes max)

### Option 2: Using SQL Editor

```sql
-- Change to 600 TND
UPDATE site_settings 
SET setting_value = '600' 
WHERE setting_key = 'global_free_shipping_threshold';
```

### Option 3: Temporarily Disable Free Shipping

```sql
UPDATE site_settings 
SET setting_value = 'false' 
WHERE setting_key = 'free_shipping_enabled';
```

To re-enable:
```sql
UPDATE site_settings 
SET setting_value = 'true' 
WHERE setting_key = 'free_shipping_enabled';
```

## 🌍 Country-Specific Overrides (Optional)

If you want a different threshold for a specific country:

```sql
-- Example: Tunisia gets free shipping at 400 TND instead of global 500 TND
UPDATE shipping_rates 
SET free_shipping_threshold = 400 
WHERE country_code = 'TN' AND shipping_method = 'standard';

-- To remove override and use global threshold:
UPDATE shipping_rates 
SET free_shipping_threshold = NULL 
WHERE country_code = 'TN';
```

## 📊 How It Works

### Priority Order:
1. **Country-specific threshold** (if set in `shipping_rates` table)
2. **Global threshold** (from `site_settings` table) ← Most common
3. **Fallback** (500 TND default if settings not found)

### Example Scenarios:

**Scenario 1: Global threshold only**
- Global threshold: 500 TND
- Customer adds 550 TND worth of products
- Result: ✅ Free shipping for all countries

**Scenario 2: Country override**
- Global threshold: 500 TND
- Tunisia specific: 400 TND
- Other countries: Use global 500 TND
- Tunisian customer with 450 TND: ✅ Free shipping
- Algerian customer with 450 TND: ❌ Pays shipping (needs 500)

**Scenario 3: Promotional threshold**
```sql
-- Black Friday: Free shipping at 300 TND
UPDATE site_settings 
SET setting_value = '300' 
WHERE setting_key = 'global_free_shipping_threshold';

-- After promotion: Back to 500 TND
UPDATE site_settings 
SET setting_value = '500' 
WHERE setting_key = 'global_free_shipping_threshold';
```

## 🔍 Check Current Settings

```sql
-- View all shipping settings
SELECT * FROM site_settings WHERE category = 'shipping';

-- View current free shipping threshold
SELECT setting_value as current_threshold 
FROM site_settings 
WHERE setting_key = 'global_free_shipping_threshold';
```

## 💡 Marketing Tips

### Show "X TND away from free shipping" message:

The `calculateShipping()` function returns `amountNeeded`:
```typescript
const { cost, isFree, amountNeeded, threshold } = await calculateShipping('TN', 450);

if (!isFree && amountNeeded > 0) {
  // Show: "Add 50 TND more for FREE shipping! 🎉"
  console.log(`Add ${amountNeeded} TND more for FREE shipping!`);
}
```

### Common Thresholds:
- **Low**: 100-200 TND (encourages frequent orders)
- **Medium**: 300-500 TND (balances shipping costs)
- **High**: 600-800 TND (increases average order value)
- **Premium**: 1000+ TND (luxury/high-margin products)

## 🎨 Display in UI

```typescript
// In your cart or checkout component
const { isEligible, amountNeeded, threshold } = await checkFreeShippingEligibility(subtotal);

if (isEligible) {
  return <div>🎉 You get FREE shipping!</div>;
} else {
  return <div>Add {amountNeeded} TND more for FREE shipping!</div>;
}
```

## 🚀 Best Practices

1. **A/B Test**: Try different thresholds to find optimal conversion
2. **Seasonal**: Lower during holidays, raise during busy periods
3. **Communicate**: Always show threshold clearly to customers
4. **Track**: Monitor how threshold changes affect order values
5. **Regional**: Use country overrides for different markets

## 📈 Analytics Query

See impact of free shipping:
```sql
SELECT 
  COUNT(*) as total_orders,
  COUNT(CASE WHEN shipping_cost = 0 THEN 1 END) as free_shipping_orders,
  ROUND(COUNT(CASE WHEN shipping_cost = 0 THEN 1 END) * 100.0 / COUNT(*), 2) as free_shipping_rate,
  AVG(subtotal) as avg_order_value
FROM orders
WHERE created_at > NOW() - INTERVAL '30 days';
```

