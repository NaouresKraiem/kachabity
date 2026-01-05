-- Add link_url column to promotions table for social media links
-- This allows adding Instagram, TikTok, or any external links to promotional banners

-- 1. Add the link_url column
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS link_url TEXT;

-- 2. Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'promotions' 
AND column_name = 'link_url';



