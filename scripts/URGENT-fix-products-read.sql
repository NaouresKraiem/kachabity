-- URGENT FIX: Allow reading products and related tables
-- Run this in Supabase SQL Editor NOW

-- Fix PRODUCTS table
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view products" ON products;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view products"
    ON products FOR SELECT TO public USING (true);

-- Fix PRODUCT_IMAGES table  
ALTER TABLE product_images DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view product_images" ON product_images;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view product_images"
    ON product_images FOR SELECT TO public USING (true);

-- Fix PRODUCT_VARIANTS table
ALTER TABLE product_variants DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view product_variants" ON product_variants;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view product_variants"
    ON product_variants FOR SELECT TO public USING (true);

-- Verify
SELECT 
    tablename,
    COUNT(*) as "Number of SELECT Policies"
FROM pg_policies
WHERE tablename IN ('products', 'product_images', 'product_variants')
    AND cmd = 'SELECT'
GROUP BY tablename;



