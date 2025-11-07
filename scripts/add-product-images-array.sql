-- Add images array (jsonb) to products, default empty array
ALTER TABLE products
ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Optional: backfill images from image_url into images if empty
UPDATE products
SET images = jsonb_build_array(jsonb_build_object('id', id, 'url', image_url, 'alt', title))
WHERE (images = '[]'::jsonb OR images IS NULL) AND image_url IS NOT NULL AND image_url <> '';

-- Ensure RLS policies (if any) allow reading this column implicitly via SELECT *
-- No changes needed if existing policies already permit selecting all columns.

