-- Seed hero sections using real product data
-- This script will populate the hero section with actual product images

-- Clear existing hero sections
TRUNCATE TABLE public.hero_sections CASCADE;

-- Insert carousel slides using featured products
INSERT INTO public.hero_sections (
    title, 
    subtitle, 
    sub_subtitle,
    cta_label, 
    cta_href, 
    image_url, 
    is_active, 
    sort_order
)
SELECT 
    'Top Saled' as title,
    'Quachabia' as subtitle,
    'Handmade' as sub_subtitle,
    'Buy Now' as cta_label,
    '/products/' || slug as cta_href,
    image_url,
    true as is_active,
    0 as sort_order
FROM public.products 
WHERE slug = 'traditional-kachabia-blue'
LIMIT 1;

-- Carousel Slide 2
INSERT INTO public.hero_sections (
    title, 
    subtitle, 
    sub_subtitle,
    cta_label, 
    cta_href, 
    image_url, 
    is_active, 
    sort_order
)
SELECT 
    'New Arrival' as title,
    'Premium Barnous' as subtitle,
    'Traditional Elegance' as sub_subtitle,
    'Shop Now' as cta_label,
    '/products/' || slug as cta_href,
    image_url,
    true as is_active,
    1 as sort_order
FROM public.products 
WHERE slug = 'cream-barnous'
LIMIT 1;

-- Left sidebar card with fallback image
INSERT INTO public.hero_sections (
    title,
    subtitle,
    sub_subtitle,
    left_image_url,
    cta_label,
    cta_href,
    is_active,
    sort_order
)
SELECT
    'Where' as title,
    'Tradition Meets Elegance' as subtitle,
    'قشابيتي' as sub_subtitle,
    image_url as left_image_url,
    'Order Now' as cta_label,
    '/products' as cta_href,
    true as is_active,
    2 as sort_order
FROM public.products
WHERE slug = 'handwoven-straw-bag'
LIMIT 1;

-- Right card 1 - Big deal (Kachabia)
INSERT INTO public.hero_sections (
    title,
    subtitle,
    sub_subtitle,
    image_url,
    cta_label,
    cta_href,
    is_active,
    sort_order
)
SELECT
    'Big deal' as title,
    'Big deal ' || title as subtitle,
    'Buy 1 Get 1' as sub_subtitle,
    image_url,
    'Buy Now' as cta_label,
    '/products/' || slug as cta_href,
    true as is_active,
    3 as sort_order
FROM public.products
WHERE slug = 'traditional-kachabia-blue'
LIMIT 1;

-- Right card 2 - New item (Home decor)
INSERT INTO public.hero_sections (
    title,
    subtitle,
    sub_subtitle,
    image_url,
    cta_label,
    cta_href,
    is_active,
    sort_order
)
SELECT
    'New' as title,
    title as subtitle,
    'Home Accessories' as sub_subtitle,
    image_url,
    'Shop Now' as cta_label,
    '/products/' || slug as cta_href,
    true as is_active,
    4 as sort_order
FROM public.products
WHERE slug = 'wooden-home-decor'
LIMIT 1;

-- Verify the inserted data
SELECT 
    sort_order,
    title,
    subtitle,
    sub_subtitle,
    cta_label,
    CASE 
        WHEN image_url IS NOT NULL THEN 'Has image_url'
        WHEN left_image_url IS NOT NULL THEN 'Has left_image_url'
        ELSE 'No image'
    END as image_status
FROM public.hero_sections 
ORDER BY sort_order;

