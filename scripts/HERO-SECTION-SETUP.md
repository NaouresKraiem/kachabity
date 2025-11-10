# Hero Section Setup Guide

## Overview
The hero section displays a dynamic carousel with featured products, promotional cards, and small product highlights. All data is pulled from the `hero_sections` and `small_cards` tables in Supabase.

## Database Structure

### Hero Sections Table
The `hero_sections` table supports different types of cards based on `sort_order`:

- **sort_order 0-1**: Carousel slides (main center section)
- **sort_order 2**: Left sidebar card
- **sort_order 3-4**: Right promotional cards

### Fields:
- `title`: Main heading (e.g., "Top Saled", "Big deal")
- `subtitle`: Secondary heading (e.g., "Quachabia", product name)
- `sub_subtitle`: Additional text (e.g., "Handmade", "Buy 1 Get 1")
- `image_url`: Product image for carousel and right cards
- `left_image_url`: Image for left sidebar card
- `cta_label`: Button text (e.g., "Buy Now", "Shop Now")
- `cta_href`: Link destination (e.g., "/products", "/products/slug")
- `is_active`: Boolean to enable/disable
- `sort_order`: Determines position (0-indexed)

## Setup Instructions

### Step 1: Seed Hero Data
Run the SQL script to populate hero sections with real product data:

```bash
# In Supabase SQL Editor, run:
/scripts/seed-hero-with-products.sql
```

This will:
- Create 2 carousel slides
- Set up the left sidebar card
- Add 2 right promotional cards
- Use real product images from your products table

### Step 2: Update Images (Optional)
If you want to use your own images:

1. Upload images to Supabase Storage in the `hero-images` bucket
2. Update the hero sections with new image URLs:

```sql
UPDATE public.hero_sections 
SET image_url = 'https://your-supabase-url/storage/v1/object/public/hero-images/your-image.jpg'
WHERE sort_order = 0;
```

### Step 3: Customize Content
Update any hero section directly in Supabase:

```sql
-- Update carousel slide
UPDATE public.hero_sections 
SET 
    title = 'Your Title',
    subtitle = 'Your Subtitle',
    sub_subtitle = 'Your Description',
    cta_label = 'Your Button Text'
WHERE sort_order = 0;

-- Update right promotional card
UPDATE public.hero_sections 
SET 
    subtitle = 'Special Offer',
    sub_subtitle = '50% OFF Today',
    cta_href = '/products/special-offer'
WHERE sort_order = 3;
```

## Small Cards Setup

### Small Cards Table
The `small_cards` table provides additional promotional tiles:

- **sort_order 1-3**: Bottom cards under carousel
- **sort_order 4-5**: Small cards on the right side

### Update Small Cards:
```sql
UPDATE public.small_cards 
SET 
    title = 'Your Title',
    subtitle = 'Your Subtitle',
    image_url = 'your-image-url',
    bg_color = 'bg-pink-100'  -- Tailwind color class
WHERE sort_order = 1;
```

### Available Background Colors:
- `bg-pink-50`, `bg-pink-100`
- `bg-green-100`
- `bg-gray-100`
- `bg-purple-100`
- `bg-blue-100`

## Component Features

### Interactive Elements:
1. **Carousel Auto-Slide**: Changes every 5 seconds
2. **Navigation Arrows**: Manual slide control
3. **Dot Indicators**: Click to jump to specific slide
4. **Clickable Cards**: All cards navigate to products
5. **Hover Effects**: Visual feedback on interaction

### Responsive Design:
- **Desktop**: Full grid layout with sidebar
- **Mobile**: Stacked layout

## Testing

### Verify Data:
```sql
-- Check all hero sections
SELECT sort_order, title, subtitle, cta_label, 
       CASE WHEN image_url IS NOT NULL THEN 'Has image' ELSE 'No image' END 
FROM public.hero_sections 
ORDER BY sort_order;

-- Check small cards
SELECT sort_order, title, subtitle, bg_color 
FROM public.small_cards 
ORDER BY sort_order;
```

### Expected Output:
- **2 carousel slides** (sort_order 0-1)
- **1 left card** (sort_order 2)
- **2 right cards** (sort_order 3-4)
- **5 small cards** (sort_order 1-5)

## Troubleshooting

### Issue: Images not showing
**Solution**: Check that:
1. Image URLs are accessible
2. Supabase storage bucket is public
3. URLs are properly formatted with tokens if needed

### Issue: Cards not displaying
**Solution**: Verify:
1. `is_active = true` in database
2. Data exists for all sort_orders
3. Check console logs for errors

### Issue: Carousel not working
**Solution**: 
1. Ensure at least 1 carousel slide exists (sort_order 0)
2. Check browser console for JavaScript errors
3. Verify `image_url` is not null

## Best Practices

1. **Always use high-quality images** (minimum 500x500px)
2. **Keep titles short** (max 30 characters)
3. **Test on mobile** before deploying
4. **Update regularly** to keep content fresh
5. **Use real product links** in `cta_href`

## Quick Updates

### Change Main Carousel Product:
```sql
UPDATE public.hero_sections 
SET image_url = (
    SELECT image_url FROM products WHERE slug = 'your-product-slug'
)
WHERE sort_order = 0;
```

### Swap Promotional Cards:
```sql
-- Swap right card positions
UPDATE public.hero_sections SET sort_order = 99 WHERE sort_order = 3;
UPDATE public.hero_sections SET sort_order = 3 WHERE sort_order = 4;
UPDATE public.hero_sections SET sort_order = 4 WHERE sort_order = 99;
```

## Need Help?
Check the component code in: `/components/sections/HeroSection.tsx`

