-- Setup Hero Sections with NEW Structure
-- sort_order 0-1: Right promotional cards (fixed)
-- sort_order 2: Left sidebar card
-- sort_order 3+: Carousel slides (infinite)

-- Clear existing data (optional)
-- TRUNCATE TABLE public.hero_sections CASCADE;

-- ===========================================
-- RIGHT PROMOTIONAL CARDS (0-1) - FIXED
-- ===========================================

-- Right Card 1 (Top) - Big Deal
INSERT INTO public.hero_sections (
    sort_order, title, subtitle, sub_subtitle,
    image_url, bg_color, text_color,
    cta_label, cta_href, is_active
) VALUES (
    0, -- RIGHT CARD 1
    'Big deal',
    'Big deal Kachabia',
    'Buy 1 Get 1',
    'https://your-supabase.co/storage/v1/object/public/product-images/kachabia.png',
    '#FDE0E6', -- Pink background
    '#7a3b2e', -- Brown text
    'Buy Now',
    '/products/kachabia',
    true
) ON CONFLICT (id) DO NOTHING;

-- Right Card 2 (Bottom) - New Item
INSERT INTO public.hero_sections (
    sort_order, title, subtitle, sub_subtitle,
    image_url, bg_color, text_color,
    cta_label, cta_href, is_active
) VALUES (
    1, -- RIGHT CARD 2
    'New',
    'New Collection',
    'Home Accessories',
    'https://your-supabase.co/storage/v1/object/public/product-images/decor.png',
    '#D4F4DD', -- Green background
    '#2b1a16', -- Dark brown text
    'Shop Now',
    '/products/home-decor',
    true
) ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- LEFT SIDEBAR CARD (2) - BRAND MESSAGE
-- ===========================================

INSERT INTO public.hero_sections (
    sort_order, title, subtitle, sub_subtitle,
    left_image_url, bg_color, text_color,
    cta_label, cta_href, is_active
) VALUES (
    2, -- LEFT SIDEBAR
    'Where',
    'Tradition Meets Elegance',
    'قشابيتي',
    'https://your-supabase.co/storage/v1/object/public/hero-images/logo.png',
    '#ACDEE6', -- Light blue
    '#000000', -- Black text
    'Order Now',
    '/products',
    true
) ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- CAROUSEL SLIDES (3+) - INFINITE!
-- ===========================================

-- Carousel Slide 1
INSERT INTO public.hero_sections (
    sort_order, title, subtitle, sub_subtitle,
    background_image_url, image_url,
    cta_label, cta_href, is_active
) VALUES (
    3, -- CAROUSEL SLIDE 1
    'Top Saled',
    'Quachabia',
    'Handmade',
    'https://your-supabase.co/storage/v1/object/public/hero-images/background-1.jpg',
    'https://your-supabase.co/storage/v1/object/public/hero-images/person-1.png',
    'Buy Now',
    '/products/quachabia',
    true
) ON CONFLICT (id) DO NOTHING;

-- Carousel Slide 2
INSERT INTO public.hero_sections (
    sort_order, title, subtitle, sub_subtitle,
    background_image_url, image_url,
    cta_label, cta_href, is_active
) VALUES (
    4, -- CAROUSEL SLIDE 2
    'New Arrival',
    'Premium Barnous',
    'Traditional Elegance',
    'https://your-supabase.co/storage/v1/object/public/hero-images/background-2.jpg',
    'https://your-supabase.co/storage/v1/object/public/hero-images/person-2.png',
    'Shop Now',
    '/products/barnous',
    true
) ON CONFLICT (id) DO NOTHING;

-- Carousel Slide 3 (Add as many as you want!)
INSERT INTO public.hero_sections (
    sort_order, title, subtitle, sub_subtitle,
    background_image_url, image_url,
    cta_label, cta_href, is_active
) VALUES (
    5, -- CAROUSEL SLIDE 3
    'Limited Edition',
    'Handwoven Textiles',
    'Exclusive Collection',
    'https://your-supabase.co/storage/v1/object/public/hero-images/background-3.jpg',
    'https://your-supabase.co/storage/v1/object/public/hero-images/person-3.png',
    'Discover',
    '/products/textiles',
    true
) ON CONFLICT (id) DO NOTHING;

-- Add more carousel slides easily:
-- sort_order 6, 7, 8, 9, 10... as many as you want!

-- ===========================================
-- VERIFY SETUP
-- ===========================================
SELECT 
    sort_order,
    CASE 
        WHEN sort_order IN (0, 1) THEN '📍 RIGHT CARD'
        WHEN sort_order = 2 THEN '📍 LEFT SIDEBAR'
        WHEN sort_order >= 3 THEN '🎬 CAROUSEL SLIDE ' || (sort_order - 2)
    END as card_position,
    title,
    subtitle,
    cta_label,
    is_active
FROM public.hero_sections
ORDER BY sort_order;

-- Expected output:
-- 0  | 📍 RIGHT CARD       | Big deal    | Big deal Kachabia
-- 1  | 📍 RIGHT CARD       | New         | New Collection
-- 2  | 📍 LEFT SIDEBAR     | Where       | Tradition Meets Elegance
-- 3  | 🎬 CAROUSEL SLIDE 1 | Top Saled   | Quachabia
-- 4  | 🎬 CAROUSEL SLIDE 2 | New Arrival | Premium Barnous
-- 5  | 🎬 CAROUSEL SLIDE 3 | Limited...  | Handwoven Textiles

