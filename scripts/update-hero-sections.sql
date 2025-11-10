-- Update hero sections with real data and add more entries
-- This will populate the carousel, left card, and right cards

-- First, clear existing hero sections
TRUNCATE TABLE public.hero_sections CASCADE;

-- Insert carousel slides (will show in main center carousel)
INSERT INTO public.hero_sections (
    title, 
    subtitle, 
    sub_subtitle,
    cta_label, 
    cta_href, 
    image_url, 
    is_active, 
    sort_order
) VALUES
-- Carousel Slide 1
('Top Saled', 'Quachabia', 'Handmade', 'Buy Now', '/products', 
 'https://fhimhbrhlzhxojtiumhm.supabase.co/storage/v1/object/sign/hero-images/hero-person-1.jpg?token=YOUR_TOKEN', 
 true, 0),

-- Carousel Slide 2  
('New Arrival', 'Traditional Barnous', 'Premium Quality', 'Shop Now', '/products',
 'https://fhimhbrhlzhxojtiumhm.supabase.co/storage/v1/object/sign/hero-images/hero-person-2.jpg?token=YOUR_TOKEN',
 true, 1);

-- Insert left sidebar card
INSERT INTO public.hero_sections (
    title,
    subtitle,
    sub_subtitle,
    left_image_url,
    cta_label,
    cta_href,
    is_active,
    sort_order
) VALUES
('Where', 'Tradition Meets Elegance', 'قشابيتي',
 'https://fhimhbrhlzhxojtiumhm.supabase.co/storage/v1/object/sign/hero-images/traditional-craft.jpg?token=YOUR_TOKEN',
 'Order Now', '/products', true, 2);

-- Insert right card 1 (Big deal)
INSERT INTO public.hero_sections (
    title,
    subtitle,
    sub_subtitle,
    image_url,
    cta_label,
    cta_href,
    is_active,
    sort_order
) VALUES
('Big deal', 'Big deal Kachabia', 'Buy 1 Get 1',
 'https://fhimhbrhlzhxojtiumhm.supabase.co/storage/v1/object/sign/product-images/kachabia-red.jpg?token=YOUR_TOKEN',
 'Buy Now', '/products', true, 3);

-- Insert right card 2 (New item)
INSERT INTO public.hero_sections (
    title,
    subtitle,
    sub_subtitle,
    image_url,
    cta_label,
    cta_href,
    is_active,
    sort_order
) VALUES
('New', 'New Item Name', 'Home Accesoire',
 'https://fhimhbrhlzhxojtiumhm.supabase.co/storage/v1/object/sign/product-images/home-decor.jpg?token=YOUR_TOKEN',
 'Shop Now', '/products', true, 4);

-- Verify the data
SELECT * FROM public.hero_sections ORDER BY sort_order;

