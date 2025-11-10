-- Add separate background_image_url column to hero_sections table
-- This allows having different images for background vs foreground product

ALTER TABLE public.hero_sections 
ADD COLUMN IF NOT EXISTS background_image_url TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN public.hero_sections.background_image_url IS 'Full background image for carousel. If null, uses image_url as background';

-- Example: Update existing hero sections with separate backgrounds
-- UPDATE public.hero_sections 
-- SET background_image_url = 'https://your-supabase-url/storage/v1/object/public/hero-images/background-1.jpg'
-- WHERE sort_order = 0;

-- Verify the changes
SELECT 
    sort_order,
    title,
    subtitle,
    CASE WHEN background_image_url IS NOT NULL THEN 'Has background' ELSE 'No background' END as bg_status,
    CASE WHEN image_url IS NOT NULL THEN 'Has product image' ELSE 'No product image' END as img_status
FROM public.hero_sections
ORDER BY sort_order;

