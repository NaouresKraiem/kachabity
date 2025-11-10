-- Option: Add card_type column for clearer card identification
-- This makes it more explicit what type of card each row represents

-- Add card_type column
ALTER TABLE public.hero_sections 
ADD COLUMN IF NOT EXISTS card_type TEXT DEFAULT 'carousel';

-- Add check constraint for valid types
ALTER TABLE public.hero_sections
ADD CONSTRAINT valid_card_type 
CHECK (card_type IN ('carousel', 'sidebar', 'promo', 'featured'));

-- Add comment
COMMENT ON COLUMN public.hero_sections.card_type IS 
'Type of card: carousel (main slides), sidebar (left card), promo (right cards), featured (special cards)';

-- Update existing rows based on sort_order
UPDATE public.hero_sections 
SET card_type = CASE 
    WHEN sort_order BETWEEN 0 AND 1 THEN 'carousel'
    WHEN sort_order = 2 THEN 'sidebar'
    WHEN sort_order BETWEEN 3 AND 4 THEN 'promo'
    ELSE 'carousel'
END;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_hero_card_type ON public.hero_sections(card_type, is_active);

-- ===========================================
-- Usage Examples
-- ===========================================

-- Get only carousel slides
SELECT * FROM hero_sections 
WHERE card_type = 'carousel' AND is_active = true 
ORDER BY sort_order;

-- Get only promotional cards
SELECT * FROM hero_sections 
WHERE card_type = 'promo' AND is_active = true 
ORDER BY sort_order;

-- Get sidebar card
SELECT * FROM hero_sections 
WHERE card_type = 'sidebar' AND is_active = true 
LIMIT 1;

-- Insert new carousel slide
INSERT INTO hero_sections (
    card_type, title, subtitle, image_url, is_active, sort_order
) VALUES (
    'carousel', 'New Product', 'Amazing Deal', 'image.jpg', true, 5
);

-- Insert new promo card
INSERT INTO hero_sections (
    card_type, title, subtitle, image_url, bg_color, is_active, sort_order
) VALUES (
    'promo', 'Special Offer', 'Limited Time', 'promo.jpg', '#FDE0E6', true, 6
);

-- Verify setup
SELECT 
    card_type,
    COUNT(*) as count,
    STRING_AGG(sort_order::text, ', ' ORDER BY sort_order) as sort_orders
FROM hero_sections
WHERE is_active = true
GROUP BY card_type
ORDER BY MIN(sort_order);

