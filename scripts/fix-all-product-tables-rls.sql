-- Fix RLS policies for all product-related tables
-- This script makes products, product_variants, and product_images tables publicly accessible

-- =============================================
-- PRODUCTS TABLE
-- =============================================

ALTER TABLE products DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view products" ON products;
DROP POLICY IF EXISTS "Public can insert products" ON products;
DROP POLICY IF EXISTS "Public can update products" ON products;
DROP POLICY IF EXISTS "Public can delete products" ON products;
DROP POLICY IF EXISTS "Service role can manage products" ON products;
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Enable insert access for all users" ON products;
DROP POLICY IF EXISTS "Enable update access for all users" ON products;
DROP POLICY IF EXISTS "Enable delete access for all users" ON products;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view products"
    ON products FOR SELECT TO public USING (true);

CREATE POLICY "Public can insert products"
    ON products FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Public can update products"
    ON products FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public can delete products"
    ON products FOR DELETE TO public USING (true);

CREATE POLICY "Service role can manage products"
    ON products FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================
-- PRODUCT_VARIANTS TABLE
-- =============================================

ALTER TABLE product_variants DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view product_variants" ON product_variants;
DROP POLICY IF EXISTS "Public can insert product_variants" ON product_variants;
DROP POLICY IF EXISTS "Public can update product_variants" ON product_variants;
DROP POLICY IF EXISTS "Public can delete product_variants" ON product_variants;
DROP POLICY IF EXISTS "Service role can manage product_variants" ON product_variants;
DROP POLICY IF EXISTS "Enable read access for all users" ON product_variants;
DROP POLICY IF EXISTS "Enable insert access for all users" ON product_variants;
DROP POLICY IF EXISTS "Enable update access for all users" ON product_variants;
DROP POLICY IF EXISTS "Enable delete access for all users" ON product_variants;

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view product_variants"
    ON product_variants FOR SELECT TO public USING (true);

CREATE POLICY "Public can insert product_variants"
    ON product_variants FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Public can update product_variants"
    ON product_variants FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public can delete product_variants"
    ON product_variants FOR DELETE TO public USING (true);

CREATE POLICY "Service role can manage product_variants"
    ON product_variants FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================
-- PRODUCT_IMAGES TABLE
-- =============================================

ALTER TABLE product_images DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view product_images" ON product_images;
DROP POLICY IF EXISTS "Public can insert product_images" ON product_images;
DROP POLICY IF EXISTS "Public can update product_images" ON product_images;
DROP POLICY IF EXISTS "Public can delete product_images" ON product_images;
DROP POLICY IF EXISTS "Service role can manage product_images" ON product_images;
DROP POLICY IF EXISTS "Enable read access for all users" ON product_images;
DROP POLICY IF EXISTS "Enable insert access for all users" ON product_images;
DROP POLICY IF EXISTS "Enable update access for all users" ON product_images;
DROP POLICY IF EXISTS "Enable delete access for all users" ON product_images;

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view product_images"
    ON product_images FOR SELECT TO public USING (true);

CREATE POLICY "Public can insert product_images"
    ON product_images FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Public can update product_images"
    ON product_images FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public can delete product_images"
    ON product_images FOR DELETE TO public USING (true);

CREATE POLICY "Service role can manage product_images"
    ON product_images FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================
-- VERIFY POLICIES
-- =============================================

SELECT 'PRODUCTS' as table_name, policyname, cmd
FROM pg_policies
WHERE tablename = 'products'
UNION ALL
SELECT 'PRODUCT_VARIANTS' as table_name, policyname, cmd
FROM pg_policies
WHERE tablename = 'product_variants'
UNION ALL
SELECT 'PRODUCT_IMAGES' as table_name, policyname, cmd
FROM pg_policies
WHERE tablename = 'product_images'
ORDER BY table_name, policyname;



