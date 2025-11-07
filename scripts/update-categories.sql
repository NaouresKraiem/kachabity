-- Update categories with the new product categories
-- Run this in Supabase SQL Editor

-- First, delete existing categories (optional - remove this if you want to keep existing data)
DELETE FROM public.categories;

-- Insert the new categories
INSERT INTO public.categories (name, slug, image_url, sort_order, is_featured) VALUES
('Kadroon', 'kadroon', 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=300', 1, true),
('Shirt', 'shirt', 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=300', 2, true),
('Blouse', 'blouse', 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=300', 3, true),
('Dungarees', 'dungarees', 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=300', 4, true),
('Burnous', 'burnous', 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=300', 5, true),
('Qachabiya', 'qachabiya', 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=300', 6, true);

-- Verify the insert
SELECT * FROM public.categories ORDER BY sort_order;

