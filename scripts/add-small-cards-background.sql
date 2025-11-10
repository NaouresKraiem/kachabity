-- Add background image and text color support to small_cards table
-- This allows small promotional cards to have background images and custom styling

ALTER TABLE public.small_cards 
ADD COLUMN IF NOT EXISTS background_image_url TEXT,
ADD COLUMN IF NOT EXISTS text_color TEXT;

-- Add comments to explain the columns
COMMENT ON COLUMN public.small_cards.background_image_url IS 'Optional background image for small cards. Creates layered effect with product image';
COMMENT ON COLUMN public.small_cards.text_color IS 'Text color (hex) for title and subtitle. Useful with dark background images';

-- Example: Update a small card with background image
-- UPDATE public.small_cards 
-- SET 
--     background_image_url = 'https://your-supabase.co/storage/v1/object/public/small-card-images/pattern-1.jpg',
--     text_color = '#FFFFFF'
-- WHERE sort_order = 1;

-- Verify the changes
SELECT 
    sort_order,
    title,
    subtitle,
    bg_color,
    CASE 
        WHEN background_image_url IS NOT NULL THEN '🖼️ Has background image'
        ELSE '🎨 Solid color only'
    END as styling,
    text_color
FROM public.small_cards
ORDER BY sort_order;

