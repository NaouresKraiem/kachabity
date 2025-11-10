-- Examples for styling small_cards with backgrounds and colors
-- Run these after adding the new columns (add-small-cards-background.sql)

-- ===========================================
-- Example 1: Small Card with Background Image
-- ===========================================
UPDATE public.small_cards 
SET 
    title = 'Flint & Kent',
    subtitle = 'Amazing Quality',
    image_url = 'https://your-supabase.co/storage/v1/object/public/product-images/decor-item.png',
    background_image_url = 'https://your-supabase.co/storage/v1/object/public/small-card-images/texture-1.jpg',
    bg_color = NULL, -- Not needed when using background image
    text_color = '#2b1a16' -- Dark text
WHERE sort_order = 1;

-- ===========================================
-- Example 2: Small Card with Solid Color (No Background)
-- ===========================================
UPDATE public.small_cards 
SET 
    title = 'Milisten Handwoven',
    subtitle = 'Sale 50%',
    image_url = 'https://your-supabase.co/storage/v1/object/public/product-images/bag.png',
    background_image_url = NULL,
    bg_color = 'bg-pink-100', -- Tailwind class or hex color
    text_color = NULL -- Use default colors
WHERE sort_order = 2;

-- ===========================================
-- Example 3: Update All 5 Small Cards at Once
-- ===========================================

-- Card 1 (Bottom carousel - left)
UPDATE public.small_cards 
SET 
    title = 'Flint & Kent',
    subtitle = 'Amazing Quality',
    bg_color = 'bg-pink-50',
    text_color = '#2b1a16'
WHERE sort_order = 1;

-- Card 2 (Bottom carousel - center)
UPDATE public.small_cards 
SET 
    title = 'Milisten Handwoven',
    subtitle = 'Sale 50%',
    bg_color = 'bg-pink-100',
    text_color = '#7a3b2e'
WHERE sort_order = 2;

-- Card 3 (Bottom carousel - right)
UPDATE public.small_cards 
SET 
    title = 'Coussin et Galette',
    subtitle = 'Sale off 50%',
    bg_color = 'bg-gray-100',
    text_color = '#2b1a16'
WHERE sort_order = 3;

-- Card 4 (Right side - bottom left)
UPDATE public.small_cards 
SET 
    title = 'Clean hands',
    subtitle = 'Clean bacteria',
    bg_color = 'bg-gray-100',
    text_color = '#2b1a16'
WHERE sort_order = 4;

-- Card 5 (Right side - bottom right)
UPDATE public.small_cards 
SET 
    title = 'Nice bag',
    subtitle = 'Nice style',
    bg_color = 'bg-green-100',
    text_color = '#2b1a16'
WHERE sort_order = 5;

-- ===========================================
-- Example 4: Mix of Background Images and Colors
-- ===========================================

-- Cards with background images (1, 3)
UPDATE public.small_cards 
SET 
    background_image_url = 'https://your-supabase.co/storage/v1/object/public/patterns/weave-pattern.jpg',
    bg_color = NULL,
    text_color = '#FFFFFF'
WHERE sort_order IN (1, 3);

-- Cards with solid colors (2, 4, 5)
UPDATE public.small_cards 
SET 
    background_image_url = NULL,
    text_color = '#2b1a16'
WHERE sort_order IN (2, 4, 5);

-- ===========================================
-- Tailwind Color Classes Reference
-- ===========================================

-- Pink Tones:
-- bg-pink-50, bg-pink-100, bg-pink-200

-- Gray Tones:
-- bg-gray-50, bg-gray-100, bg-gray-200

-- Green Tones:
-- bg-green-50, bg-green-100, bg-green-200

-- Blue Tones:
-- bg-blue-50, bg-blue-100, bg-blue-200

-- Or use hex colors:
-- #FDE0E6 (Pink)
-- #D4F4DD (Green)
-- #F3F4F6 (Gray)

-- ===========================================
-- Text Color Recommendations
-- ===========================================

-- Light Backgrounds (use dark text):
-- text_color = '#2b1a16' (Dark brown - brand)
-- text_color = '#000000' (Black)
-- text_color = '#7a3b2e' (Medium brown)

-- Dark Backgrounds (use light text):
-- text_color = '#FFFFFF' (White)
-- text_color = '#F5F5F5' (Off-white)

-- ===========================================
-- Complete Example: All Cards Styled
-- ===========================================

-- Update all 5 small cards with cohesive styling
BEGIN;

-- Bottom carousel cards (3 cards)
UPDATE public.small_cards SET
    title = 'Premium Quality',
    subtitle = 'Handcrafted Items',
    bg_color = 'bg-pink-50',
    text_color = '#2b1a16',
    image_url = 'https://your-supabase.co/storage/v1/object/public/products/item-1.png'
WHERE sort_order = 1;

UPDATE public.small_cards SET
    title = 'Special Offer',
    subtitle = 'Save up to 50%',
    background_image_url = 'https://your-supabase.co/storage/v1/object/public/patterns/fabric.jpg',
    text_color = '#FFFFFF',
    image_url = 'https://your-supabase.co/storage/v1/object/public/products/item-2.png'
WHERE sort_order = 2;

UPDATE public.small_cards SET
    title = 'New Arrivals',
    subtitle = 'Fresh Collection',
    bg_color = 'bg-green-100',
    text_color = '#2b1a16',
    image_url = 'https://your-supabase.co/storage/v1/object/public/products/item-3.png'
WHERE sort_order = 3;

-- Right side bottom cards (2 cards)
UPDATE public.small_cards SET
    title = 'Eco Friendly',
    subtitle = 'Sustainable',
    bg_color = 'bg-gray-100',
    text_color = '#2b1a16',
    image_url = 'https://your-supabase.co/storage/v1/object/public/products/item-4.png'
WHERE sort_order = 4;

UPDATE public.small_cards SET
    title = 'Gift Ideas',
    subtitle = 'Perfect Gifts',
    bg_color = 'bg-blue-100',
    text_color = '#2b1a16',
    image_url = 'https://your-supabase.co/storage/v1/object/public/products/item-5.png'
WHERE sort_order = 5;

COMMIT;

-- ===========================================
-- Verify Your Changes
-- ===========================================
SELECT 
    sort_order,
    title,
    subtitle,
    CASE 
        WHEN background_image_url IS NOT NULL THEN '🖼️ Background image'
        WHEN bg_color LIKE 'bg-%' THEN '🎨 Tailwind color'
        WHEN bg_color LIKE '#%' THEN '🎨 Hex color'
        ELSE '⚠️ No styling'
    END as styling_type,
    bg_color,
    text_color,
    is_active
FROM public.small_cards
WHERE is_active = true
ORDER BY sort_order;

