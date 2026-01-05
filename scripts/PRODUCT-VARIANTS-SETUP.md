# Product Variants Setup Guide

This guide explains how to set up and use the product variants system, which allows products to have different colors, sizes, images, and stock levels.

## Overview

The product variants system enables:
- ✅ Different colors for the same product
- ✅ Different sizes for each color
- ✅ Different images for each color variant
- ✅ Individual stock management per variant
- ✅ Variant-specific pricing (optional)
- ✅ Filtering products by color
- ✅ Dynamic image switching when color is selected

## Step 1: Run Database Migration

Run the SQL migration to create the `product_variants` table:

```sql
-- Run this in your Supabase SQL Editor
-- File: scripts/create-product-variants-table.sql
```

This creates:
- `product_variants` table with columns for color, size, images, stock, price, etc.
- Indexes for better performance
- Row Level Security (RLS) policies
- Automatic timestamp updates

## Step 2: Add Variants via Admin Panel

1. Go to Admin → Products
2. Create a new product or edit an existing one
3. Scroll to the "Product Variants" section
4. Click "+ Add Variant"
5. For each variant, fill in:
   - **Color**: Hex code (e.g., `#FF0000`) or color name (e.g., `Red`)
   - **Size**: Size value (e.g., `S`, `M`, `L`, `XL`)
   - **Stock**: Available quantity for this variant
   - **SKU**: Optional Stock Keeping Unit
   - **Variant Price**: Optional - leave empty to use product base price
   - **Variant Images**: Upload images specific to this color/size
   - **Active**: Checkbox to enable/disable the variant

### Example Variant Setup

For a T-shirt product with 3 colors and 4 sizes:

**Variant 1:**
- Color: `#FF0000` (Red)
- Size: `S`
- Stock: `10`
- Images: Upload red T-shirt images

**Variant 2:**
- Color: `#FF0000` (Red)
- Size: `M`
- Stock: `15`
- Images: Upload red T-shirt images

**Variant 3:**
- Color: `#0000FF` (Blue)
- Size: `S`
- Stock: `8`
- Images: Upload blue T-shirt images

... and so on for all color/size combinations.

## Step 3: How It Works on Product Pages

### Color Selection
- When a customer selects a color, the product images automatically switch to show that color's variant images
- Available sizes are filtered to show only sizes available for the selected color
- Stock is updated to reflect the selected variant's stock

### Size Selection
- Sizes are filtered based on the selected color
- If a size is out of stock for the selected color, it's disabled
- Selecting a size updates the variant and may change images if that variant has different images

### Image Display
- If a variant has images, those are displayed
- If a variant only has an `image_url`, that single image is shown
- Falls back to product base images if variant has no images

## Step 4: Filtering Products by Color

The system supports filtering products by color. You can:

1. Query variants by color:
```typescript
const { data } = await supabase
  .from('product_variants')
  .select('product_id, product:products(*)')
  .eq('color', '#FF0000')
  .eq('is_active', true);
```

2. Get unique colors for a product:
```typescript
const { data } = await supabase
  .from('product_variants')
  .select('color')
  .eq('product_id', productId)
  .eq('is_active', true);
```

## Database Structure

### `product_variants` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `product_id` | UUID | Foreign key to products |
| `color` | TEXT | Color name or hex code |
| `size` | TEXT | Size (S, M, L, etc.) |
| `sku` | TEXT | Stock Keeping Unit (unique) |
| `price_cents` | INTEGER | Optional variant price |
| `stock` | INTEGER | Stock for this variant |
| `images` | JSONB | Array of image objects |
| `image_url` | TEXT | Primary image URL |
| `is_active` | BOOLEAN | Whether variant is available |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

## API Endpoints

### Variants API (`/api/admin/variants`)

- **GET**: Fetch variants for a product
  - Query: `?product_id=UUID`
  
- **POST**: Create a new variant
  - Body: `{ product_id, color, size, stock, images, ... }`
  
- **PUT**: Update a variant
  - Body: `{ id, color, size, stock, images, ... }`
  
- **DELETE**: Delete a variant
  - Query: `?id=UUID`

### Products API (Updated)

The products API now includes variants:
- **GET**: Returns products with `product_variants` array
- **POST**: Can create products with variants in one request
- **PUT**: Can update products and their variants

## Best Practices

1. **Always set a color or size**: At least one should be set to create a meaningful variant
2. **Upload variant-specific images**: Different colors should have different images
3. **Manage stock per variant**: Track inventory accurately per color/size
4. **Use SKUs**: Helps with inventory management and order processing
5. **Set variant prices only when different**: Leave empty to use product base price
6. **Deactivate instead of deleting**: Set `is_active = false` to temporarily disable variants

## Migration from Old System

If you have products using the old `colors` and `sizes` JSONB arrays:

1. The system still supports the old format as a fallback
2. Products without variants will use the old `colors` and `sizes` arrays
3. To migrate:
   - Create variants for existing products via the admin panel
   - Or write a migration script to convert `colors`/`sizes` arrays to variants

## Troubleshooting

**Images not switching when color is selected:**
- Ensure the variant has images uploaded
- Check that `is_active` is `true` for the variant
- Verify the color value matches exactly

**Sizes not filtering correctly:**
- Ensure variants have both `color` and `size` set
- Check that variants are marked as `is_active`
- Verify stock levels are correct

**Variants not showing in admin:**
- Check RLS policies are set correctly
- Ensure you're logged in as an admin
- Verify the product has variants created



