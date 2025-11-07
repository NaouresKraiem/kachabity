-- Add additional fields to products table for detailed product pages

-- Add color options (array of hex colors or color names)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS colors TEXT[];

-- Add size options (array of size strings like 'S', 'M', 'L', 'XL', etc.)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS sizes TEXT[];

-- Add weight in grams
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS weight DECIMAL(10,2);

-- Add product details (array of detail points)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS product_details TEXT[];

-- Add shipping information
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS shipping_info TEXT;

-- Add seller information
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS seller_info TEXT;

-- Add rating (average rating out of 5)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 4.0;

-- Add review count
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Add additional images (JSON array of image objects)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS images JSONB;

-- Add category_id (foreign key to categories table)
-- Note: Make sure you have a categories table first!
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Update existing products with default values
-- First, get a category ID (adjust as needed)
DO $$
DECLARE
    default_category_id UUID;
BEGIN
    -- Get the first category ID, or create a default one
    SELECT id INTO default_category_id FROM categories LIMIT 1;
    
    -- If no category exists, you may want to create one first
    -- INSERT INTO categories (name, slug) VALUES ('Traditional Wear', 'traditional-wear') RETURNING id INTO default_category_id;
    
    UPDATE products 
    SET 
        colors = ARRAY['#D4AF37', '#2F4F4F', '#DEB887', '#9370DB']::TEXT[],
        sizes = ARRAY['S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL']::TEXT[],
        weight = 350,
        product_details = ARRAY['100% cotton', 'Handmade', 'Traditional design']::TEXT[],
        shipping_info = 'Free shipping on orders over 100 TND. Delivery within 3-5 business days.',
        seller_info = 'Kachabity - Traditional Handcrafted Products',
        rating = 4.3,
        review_count = (random() * 1000 + 100)::INTEGER,
        category_id = default_category_id
    WHERE colors IS NULL;
END $$;

-- Example: Update images for better product display
-- UPDATE products 
-- SET images = '[
--     {"id": "1", "url": "/path/to/image1.jpg", "alt": "Front view"},
--     {"id": "2", "url": "/path/to/image2.jpg", "alt": "Side view"},
--     {"id": "3", "url": "/path/to/image3.jpg", "alt": "Detail view"}
-- ]'::JSONB
-- WHERE id = 'your-product-id';

COMMENT ON COLUMN products.colors IS 'Array of available color options (hex codes or names)';
COMMENT ON COLUMN products.sizes IS 'Array of available size options';
COMMENT ON COLUMN products.weight IS 'Product weight in grams';
COMMENT ON COLUMN products.product_details IS 'Array of product detail bullet points';
COMMENT ON COLUMN products.shipping_info IS 'Shipping information text';
COMMENT ON COLUMN products.seller_info IS 'Seller information text';
COMMENT ON COLUMN products.rating IS 'Average product rating (0-5)';
COMMENT ON COLUMN products.review_count IS 'Number of customer reviews';
COMMENT ON COLUMN products.images IS 'JSON array of additional product images';
COMMENT ON COLUMN products.category_id IS 'Foreign key to categories table for grouping similar items';

