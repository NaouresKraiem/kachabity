-- Fix RLS policies for product_variants table
-- This script makes the product_variants table publicly accessible for CRUD operations

-- Disable RLS temporarily
ALTER TABLE product_variants DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Public can view product_variants" ON product_variants;
DROP POLICY IF EXISTS "Public can insert product_variants" ON product_variants;
DROP POLICY IF EXISTS "Public can update product_variants" ON product_variants;
DROP POLICY IF EXISTS "Public can delete product_variants" ON product_variants;
DROP POLICY IF EXISTS "Service role can manage product_variants" ON product_variants;
DROP POLICY IF EXISTS "Enable read access for all users" ON product_variants;
DROP POLICY IF EXISTS "Enable insert access for all users" ON product_variants;
DROP POLICY IF EXISTS "Enable update access for all users" ON product_variants;
DROP POLICY IF EXISTS "Enable delete access for all users" ON product_variants;

-- Re-enable RLS
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Create public policies (no authentication required)
CREATE POLICY "Public can view product_variants"
    ON product_variants
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Public can insert product_variants"
    ON product_variants
    FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Public can update product_variants"
    ON product_variants
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Public can delete product_variants"
    ON product_variants
    FOR DELETE
    TO public
    USING (true);

-- Also create policies for service_role (admin operations)
CREATE POLICY "Service role can manage product_variants"
    ON product_variants
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'product_variants'
ORDER BY policyname;



