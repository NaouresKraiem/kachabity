-- Add missing columns to products table
-- Run this in Supabase SQL Editor

-- Multi-language title columns
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS title_ar TEXT,
ADD COLUMN IF NOT EXISTS title_fr TEXT;

-- Multi-language description columns
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS description_ar TEXT,
ADD COLUMN IF NOT EXISTS description_fr TEXT;

-- Product gallery images (JSONB array)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Product variants
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS colors JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS sizes JSONB DEFAULT '[]'::jsonb;

-- Product details
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS product_details JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS shipping_info TEXT,
ADD COLUMN IF NOT EXISTS seller_info TEXT,
ADD COLUMN IF NOT EXISTS weight NUMERIC;

-- Promotional features
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_promo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS promo_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sold_count INTEGER DEFAULT 0;

-- Comments for documentation
COMMENT ON COLUMN products.title_ar IS 'Product title in Arabic';
COMMENT ON COLUMN products.title_fr IS 'Product title in French';
COMMENT ON COLUMN products.description_ar IS 'Product description in Arabic';
COMMENT ON COLUMN products.description_fr IS 'Product description in French';
COMMENT ON COLUMN products.images IS 'Array of additional product images (JSONB)';
COMMENT ON COLUMN products.colors IS 'Available colors as hex codes (JSONB array)';
COMMENT ON COLUMN products.sizes IS 'Available sizes (JSONB array)';
COMMENT ON COLUMN products.product_details IS 'Product details as bullet points (JSONB array)';
COMMENT ON COLUMN products.shipping_info IS 'Shipping information text';
COMMENT ON COLUMN products.seller_info IS 'Seller/brand information';
COMMENT ON COLUMN products.weight IS 'Product weight in grams';
COMMENT ON COLUMN products.is_promo IS 'Is this a promotional product';
COMMENT ON COLUMN products.promo_end_date IS 'End date for promotional pricing';
COMMENT ON COLUMN products.sold_count IS 'Number of units sold';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_is_promo ON products(is_promo) WHERE is_promo = true;
CREATE INDEX IF NOT EXISTS idx_products_promo_end_date ON products(promo_end_date) WHERE promo_end_date IS NOT NULL;

SELECT 'Migration completed successfully! All columns added.' AS status;



