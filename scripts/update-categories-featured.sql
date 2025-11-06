-- Update categories to mark them as featured
-- Run this in Supabase SQL Editor

-- Make sure is_featured column exists (if not, create it)
-- ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT true;

-- Set all categories as featured
UPDATE public.categories 
SET is_featured = true;

-- Verify the update
SELECT id, name, slug, is_featured, sort_order FROM public.categories ORDER BY sort_order;

