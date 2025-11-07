# Quick Start: Run Database Migrations

Follow these steps to add the promo products feature to your database.

## 🚀 Steps

### 1. Open Supabase SQL Editor

Go to your Supabase project → SQL Editor

### 2. Run These Scripts (in order)

Copy and paste each script into the SQL Editor and click "Run":

#### Script 1: Add Product Discounts
```bash
File: scripts/add-product-discounts.sql
```
This adds the `discount_percent` column.

#### Script 2: Add Promo End Dates  
```bash
File: scripts/add-promo-end-dates.sql
```
This adds the `promo_end_date` column and sets sample dates.

#### Script 3: Add Sold Count
```bash
File: scripts/add-sold-count.sql
```
This adds the `sold_count` column for social proof.

### 3. Verify

Run this query to check if it worked:

```sql
SELECT 
  title, 
  discount_percent, 
  promo_end_date, 
  sold_count, 
  stock
FROM products
WHERE discount_percent IS NOT NULL
ORDER BY discount_percent DESC;
```

You should see products with discounts, promo end dates, and sold counts.

### 4. Add Component to Your Page

```tsx
import PromoProducts from '@/components/PromoProducts';

export default function Home() {
  return (
    <>
      <PromoProducts />
    </>
  );
}
```

## ✅ Done!

Your promo products section should now display with:
- Countdown timers ⏰
- Stock progress bars 📊  
- Discount badges 🏷️
- Auto-filtering of expired promos 🔄

---

## 📝 Notes

- The scripts are **safe to run multiple times** (they use `IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS`)
- Sample data sets promos to expire in 4-7 days
- To add new promos, see `SETUP-PROMO-PRODUCTS.md` for examples

