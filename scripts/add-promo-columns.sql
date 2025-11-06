-- Add promotional product columns to products table
-- Run this in Supabase SQL Editor

-- Add promo columns
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_promo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS promo_end_date TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON COLUMN products.is_promo IS 'Is this a promotional product with countdown timer';
COMMENT ON COLUMN products.promo_end_date IS 'End date/time for promotional pricing';

-- Create index for better performance when querying promo products
CREATE INDEX IF NOT EXISTS idx_products_is_promo ON products(is_promo) WHERE is_promo = true;
CREATE INDEX IF NOT EXISTS idx_products_promo_end_date ON products(promo_end_date) WHERE promo_end_date IS NOT NULL;

-- Verify the columns were added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND column_name IN ('is_promo', 'promo_end_date')
ORDER BY column_name;

SELECT '✅ Promotional columns added successfully!' AS status;



