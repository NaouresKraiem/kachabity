-- Add Demo Video Content to Test the Slider
-- Run this in Supabase SQL Editor to add sample videos

-- First, make sure the table structure is correct
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE promotions 
ALTER COLUMN starts_at DROP NOT NULL;

ALTER TABLE promotions 
ALTER COLUMN ends_at DROP NOT NULL;

ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS link_url TEXT;

-- Insert 5 demo videos (you can replace with your actual content later)

-- Video 1: New Products
INSERT INTO promotions (
    title,
    subtitle,
    badge_text,
    discount_percent,
    image_url,
    link_url,
    starts_at,
    ends_at,
    active
) VALUES (
    'منتجاتنا الجديدة',
    'تعرف على أحدث المنتجات والتصاميم العصرية',
    'جديد',
    0,
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1280&h=720&fit=crop',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    NULL,
    NULL,
    true
);

-- Video 2: Special Offers
INSERT INTO promotions (
    title,
    subtitle,
    badge_text,
    discount_percent,
    image_url,
    link_url,
    starts_at,
    ends_at,
    active
) VALUES (
    'عروض حصرية',
    'خصومات مميزة على مجموعة مختارة من المنتجات',
    'عرض',
    0,
    'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1280&h=720&fit=crop',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    NULL,
    NULL,
    true
);

-- Video 3: Product Showcase
INSERT INTO promotions (
    title,
    subtitle,
    badge_text,
    discount_percent,
    image_url,
    link_url,
    starts_at,
    ends_at,
    active
) VALUES (
    'جودة منتجاتنا',
    'استكشف جودة وتنوع منتجاتنا',
    NULL,
    0,
    'https://images.unsplash.com/photo-1445205170230-053b83016050?w=1280&h=720&fit=crop',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    NULL,
    NULL,
    true
);

-- Video 4: Customer Reviews
INSERT INTO promotions (
    title,
    subtitle,
    badge_text,
    discount_percent,
    image_url,
    link_url,
    starts_at,
    ends_at,
    active
) VALUES (
    'آراء عملائنا',
    'شاهد تجارب عملائنا السعداء',
    'شائع',
    0,
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1280&h=720&fit=crop',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    NULL,
    NULL,
    true
);

-- Video 5: Behind the Scenes
INSERT INTO promotions (
    title,
    subtitle,
    badge_text,
    discount_percent,
    image_url,
    link_url,
    starts_at,
    ends_at,
    active
) VALUES (
    'من وراء الكواليس',
    'اكتشف كيف نختار منتجاتنا',
    'مميز',
    0,
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1280&h=720&fit=crop',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    NULL,
    NULL,
    true
);

-- Verify the data was inserted
SELECT id, title, badge_text, active, created_at
FROM promotions
WHERE ends_at IS NULL
ORDER BY created_at DESC;

