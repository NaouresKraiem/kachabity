# Product Detail Page Setup Guide

This guide explains how to set up the comprehensive product detail page with all features.

## Overview

The product detail page includes:
- ✅ Image gallery with thumbnails
- ✅ Product information (price, rating, stock status)
- ✅ Quantity selector
- ✅ Color selector (visual swatches)
- ✅ Size selector (S, M, L, XL, etc.)
- ✅ Expandable sections (Product Details, Shipping, Seller Info)
- ✅ Similar products carousel
- ✅ Breadcrumb navigation
- ✅ Multi-language support

## Step 1: Run Database Migration

Run the SQL migration to add necessary fields to your products table:

```sql
-- Run this in your Supabase SQL Editor
-- File: scripts/add-product-detail-fields.sql
```

This adds:
- `colors` - Array of color options
- `sizes` - Array of size options  
- `weight` - Product weight
- `product_details` - Array of detail points
- `shipping_info` - Shipping information
- `seller_info` - Seller details
- `rating` - Average rating (0-5)
- `review_count` - Number of reviews
- `images` - JSON array of multiple images
- `category` - For grouping similar products

## Step 2: Update Your Products

### Option A: Update via Supabase Dashboard

1. Go to Supabase Dashboard → Table Editor → `products`
2. Edit each product and add:
   - **Colors**: `["#D4AF37", "#2F4F4F", "#DEB887", "#9370DB"]` (gold, dark slate, tan, purple)
   - **Sizes**: `["S", "M", "L", "XL", "XXL", "XXXL", "4XL"]`
   - **Weight**: `350` (grams)
   - **Product Details**: `["100% cotton", "Handmade", "Traditional design"]`
   - **Rating**: `4.3`
   - **Review Count**: `245`
   - **Category**: `"Traditional Wear"` or `"Home Accessories"`

### Option B: Update via SQL

```sql
UPDATE products 
SET 
    colors = '["#D4AF37", "#2F4F4F", "#DEB887", "#9370DB"]',
    sizes = '["S", "M", "L", "XL", "XXL"]',
    weight = 350,
    product_details = '["100% authentic handmade", "Premium quality materials", "Traditional craftsmanship"]',
    shipping_info = 'Free shipping on orders over 100 TND',
    seller_info = 'Kachabity - Traditional Handcrafted Products',
    rating = 4.5,
    review_count = 320,
    category = 'Traditional Wear'
WHERE slug = 'your-product-slug';
```

## Step 3: Add Multiple Images (Optional)

For a better image gallery experience, add multiple product images:

```sql
UPDATE products 
SET images = '[
    {
        "id": "1",
        "url": "/assets/images/products/product-1-front.jpg",
        "alt": "Front view"
    },
    {
        "id": "2", 
        "url": "/assets/images/products/product-1-side.jpg",
        "alt": "Side view"
    },
    {
        "id": "3",
        "url": "/assets/images/products/product-1-detail.jpg", 
        "alt": "Detail view"
    },
    {
        "id": "4",
        "url": "/assets/images/products/product-1-back.jpg",
        "alt": "Back view"
    }
]'::JSONB
WHERE slug = 'your-product-slug';
```

## Step 4: Access Your Product Pages

The product detail page is now available at:

```
/en/products/[slug]
/fr/products/[slug]
/ar/products/[slug]
```

Example:
- `http://localhost:3000/en/products/hbarnous-rossini`
- `http://localhost:3000/fr/products/serviette-de-table`

## Features Breakdown

### 1. Image Gallery
- Main image display
- Thumbnail navigation on the left
- Click thumbnails to change main image
- Responsive design

### 2. Product Information
- Product title
- Star rating with review count
- Stock status (In Stock/Out of Stock)
- View count (estimated)
- Product description

### 3. Pricing
- Current price (after discount)
- Original price (crossed out if discount)
- Currency display

### 4. Quantity Selector
- Plus/minus buttons
- Direct number input
- Min: 1, Max: available stock

### 5. Color Selector
- Visual color swatches
- Active state highlighting
- Click to select

### 6. Size Selector  
- Button-style size options
- Active state with fill color
- Common sizes: S, M, L, XL, XXL, XXXL, 4XL

### 7. Expandable Sections
Three collapsible sections:
- **Product Details**: Features, materials, weight
- **Shipping Details**: Delivery cost, shipping info
- **Seller Details**: Seller information, policies

### 8. Similar Products
- Shows 4 related products from same category
- Click to navigate to that product
- Shows image, name, and price

### 9. Multi-language Support
All text translates to:
- English (en)
- French (fr)
- Arabic (ar)

## Customization

### Change Color Options

Edit the colors array to show different colors:

```typescript
colors: ["#FF0000", "#00FF00", "#0000FF"] // Red, Green, Blue
```

### Change Size Options

Edit the sizes array:

```typescript
sizes: ["XS", "S", "M", "L", "XL"] // Different size range
```

### Modify Expandable Sections

Edit the expandable sections in the component to add/remove sections or change content.

### Style Customization

The component uses Tailwind CSS. Main color is `#842E1B` (brown). You can change this throughout the component.

## Linking to Product Pages

From your product cards, link to the detail page:

```tsx
<Link href={`/${locale}/products/${product.slug}`}>
    <Image src={product.image_url} alt={product.title} />
    <h3>{product.title}</h3>
    <p>{product.price_cents} {product.currency}</p>
</Link>
```

## Next Steps

1. ✅ Run the database migration
2. ✅ Update your products with colors, sizes, etc.
3. ✅ Add multiple images for better gallery
4. ✅ Test the product detail page
5. ✅ Link from your product listings
6. Consider adding:
   - Product reviews section
   - Related products carousel
   - Share buttons (social media)
   - Recently viewed products
   - Product comparison feature

## Troubleshooting

**Problem**: Product not found
- **Solution**: Check that the product has a valid `slug` field
- Verify the slug in the URL matches the database

**Problem**: Images not loading
- **Solution**: Verify image URLs are correct
- Check images are in the `public` folder or external URLs are accessible

**Problem**: Colors/sizes not showing
- **Solution**: Make sure the `colors` and `sizes` fields are arrays
- Check the data format: `["color1", "color2"]`

**Problem**: Similar products not showing
- **Solution**: Ensure products have the same `category` value
- Check there are other products in the database

## Support

For issues or questions, contact: Kachabity@gmail.com

