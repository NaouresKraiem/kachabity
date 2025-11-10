-- Examples for styling hero section cards with backgrounds and colors
-- Run these after adding the new columns (add-hero-background-image.sql)

-- ===========================================
-- Example 1: Left Sidebar Card with Background Image
-- ===========================================
UPDATE public.hero_sections 
SET 
    background_image_url = 'https://your-supabase.co/storage/v1/object/public/hero-images/traditional-pattern.jpg',
    bg_color = NULL, -- Will use background image
    text_color = '#FFFFFF' -- White text on dark background
WHERE sort_order = 2; -- Left card

-- ===========================================
-- Example 2: Left Sidebar Card with Solid Color (No Background)
-- ===========================================
UPDATE public.hero_sections 
SET 
    background_image_url = NULL, -- No background image
    bg_color = '#ACDEE6', -- Light blue
    text_color = '#000000' -- Black text
WHERE sort_order = 2;

-- ===========================================
-- Example 3: Right Card 1 (Big Deal) with Background Image
-- ===========================================
UPDATE public.hero_sections 
SET 
    title = 'Big deal',
    subtitle = 'Big deal Kachabia',
    sub_subtitle = 'Buy 1 Get 1',
    image_url = 'https://your-supabase.co/storage/v1/object/public/product-images/kachabia-red.png', -- Product PNG
    background_image_url = 'https://your-supabase.co/storage/v1/object/public/hero-images/textile-background.jpg', -- Background
    bg_color = NULL, -- Using background image
    text_color = '#2b1a16', -- Dark brown text
    cta_label = 'Buy Now',
    cta_href = '/products/kachabia'
WHERE sort_order = 3;

-- ===========================================
-- Example 4: Right Card 1 (Big Deal) with Solid Color
-- ===========================================
UPDATE public.hero_sections 
SET 
    title = 'Big deal',
    subtitle = 'Big deal Kachabia',
    sub_subtitle = 'Buy 1 Get 1',
    image_url = 'https://your-supabase.co/storage/v1/object/public/product-images/kachabia-red.png',
    background_image_url = NULL, -- No background image
    bg_color = '#FDE0E6', -- Pink background
    text_color = '#7a3b2e', -- Brown text
    cta_label = 'Buy Now',
    cta_href = '/products/kachabia'
WHERE sort_order = 3;

-- ===========================================
-- Example 5: Right Card 2 (New Item) with Background Image
-- ===========================================
UPDATE public.hero_sections 
SET 
    title = 'New',
    subtitle = 'Home Decor Collection',
    sub_subtitle = 'Handcrafted Accessories',
    image_url = 'https://your-supabase.co/storage/v1/object/public/product-images/decor-item.png',
    background_image_url = 'https://your-supabase.co/storage/v1/object/public/hero-images/home-interior.jpg',
    bg_color = NULL,
    text_color = '#2b1a16',
    cta_label = 'Shop Now',
    cta_href = '/products/home-decor'
WHERE sort_order = 4;

-- ===========================================
-- Example 6: Right Card 2 (New Item) with Solid Color
-- ===========================================
UPDATE public.hero_sections 
SET 
    title = 'New',
    subtitle = 'Home Decor Collection',
    sub_subtitle = 'Handcrafted Accessories',
    image_url = 'https://your-supabase.co/storage/v1/object/public/product-images/decor-item.png',
    background_image_url = NULL,
    bg_color = '#D4F4DD', -- Light green
    text_color = '#2b1a16',
    cta_label = 'Shop Now',
    cta_href = '/products/home-decor'
WHERE sort_order = 4;

-- ===========================================
-- Example 7: Complete Hero Setup with All Cards
-- ===========================================

-- Carousel Slide 1
UPDATE public.hero_sections 
SET 
    background_image_url = 'https://your-supabase.co/storage/v1/object/public/hero-images/studio-background-1.jpg',
    image_url = 'https://your-supabase.co/storage/v1/object/public/hero-images/person-quachabia.png',
    text_color = '#000000'
WHERE sort_order = 0;

-- Carousel Slide 2
UPDATE public.hero_sections 
SET 
    background_image_url = 'https://your-supabase.co/storage/v1/object/public/hero-images/studio-background-2.jpg',
    image_url = 'https://your-supabase.co/storage/v1/object/public/hero-images/person-barnous.png',
    text_color = '#000000'
WHERE sort_order = 1;

-- Left Card
UPDATE public.hero_sections 
SET 
    bg_color = '#ACDEE6',
    text_color = '#000000'
WHERE sort_order = 2;

-- Right Card 1 (Big Deal)
UPDATE public.hero_sections 
SET 
    bg_color = '#FDE0E6',
    text_color = '#7a3b2e'
WHERE sort_order = 3;

-- Right Card 2 (New)
UPDATE public.hero_sections 
SET 
    bg_color = '#D4F4DD',
    text_color = '#2b1a16'
WHERE sort_order = 4;

-- ===========================================
-- Color Palette Suggestions
-- ===========================================

-- Pink Tones (for Big Deal cards):
-- #FDE0E6 (Light pink)
-- #FFC0CB (Pink)
-- #FFB6C1 (Light pink)

-- Green Tones (for New items):
-- #D4F4DD (Light mint green)
-- #E0F2E9 (Pale green)
-- #C1E1C1 (Pastel green)

-- Blue Tones (for sidebar):
-- #ACDEE6 (Light cyan)
-- #B0E0E6 (Powder blue)
-- #ADD8E6 (Light blue)

-- Neutral/Warm Tones:
-- #F5F5DC (Beige)
-- #FAF0E6 (Linen)
-- #FFF5EE (Seashell)

-- Text Colors:
-- #000000 (Black - for light backgrounds)
-- #FFFFFF (White - for dark backgrounds)
-- #2b1a16 (Dark brown - brand color)
-- #7a3b2e (Medium brown - brand accent)

-- ===========================================
-- Verify Your Setup
-- ===========================================
SELECT 
    sort_order,
    title,
    subtitle,
    CASE 
        WHEN background_image_url IS NOT NULL THEN '🖼️ Has background image'
        WHEN bg_color IS NOT NULL THEN '🎨 Has solid color'
        ELSE '⚠️ No styling'
    END as styling,
    bg_color,
    text_color,
    CASE WHEN image_url IS NOT NULL THEN '✅ Has product image' ELSE '❌ No product' END as product
FROM public.hero_sections
WHERE is_active = true
ORDER BY sort_order;

