-- Add discount_percent column to products table if it doesn't exist
-- Then update some products with discount values

-- First, ensure the column exists (safe to run multiple times)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS discount_percent INTEGER DEFAULT NULL;

-- Now add discounts to some products
UPDATE public.products
SET discount_percent = 25
WHERE slug IN ('traditional-kachabia-blue', 'ceramic-bowl-set');

UPDATE public.products
SET discount_percent = 15
WHERE slug IN ('handwoven-straw-bag', 'leather-handbag');

UPDATE public.products
SET discount_percent = 30
WHERE slug = 'patterned-cushion';

UPDATE public.products
SET discount_percent = 10
WHERE slug = 'table-napkins-set';

-- Leave other products without discounts (NULL)
-- Products with NULL or 0 won't show the discount badge

