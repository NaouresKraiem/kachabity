# Add Order Notes Column to Orders Table

## What This Does

This migration adds an `order_notes` column to the `orders` table, allowing customers to add special instructions or comments when placing orders.

## How to Run

### Option 1: Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the SQL from `add-order-notes-column.sql`
6. Click **Run** or press `Ctrl + Enter`

### Option 2: Using psql Command Line

```bash
psql postgresql://[YOUR_CONNECTION_STRING] -f scripts/add-order-notes-column.sql
```

## Verification

After running the migration, verify it worked:

```sql
-- Check if column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders' 
  AND column_name = 'order_notes';
```

You should see:
```
 column_name | data_type | is_nullable
-------------+-----------+-------------
 order_notes | text      | YES
```

## What Changed in the Code

✅ **TypeScript Interface Updated** (`lib/orders.ts`)
- Added `order_notes?: string;` to the `Order` interface

✅ **Database Insert Updated** (`lib/orders.ts`)
- Added `order_notes: orderData.orderNotes || null` to the order insert

✅ **Frontend Form** (`app/[locale]/checkout/page.tsx`)
- Order comment textarea already exists and sends data

## Testing

1. Go to checkout page
2. Add items to cart
3. Fill in shipping information
4. Add a comment in the "Order Comment" textarea
5. Complete the order
6. Check Supabase database → orders table → verify `order_notes` column has your comment

## Rollback (if needed)

If you need to remove the column:

```sql
ALTER TABLE orders DROP COLUMN IF EXISTS order_notes;
```

---

**Status:** Ready to run ✅

