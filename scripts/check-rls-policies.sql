-- Check RLS status and policies for all product-related tables

-- Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE tablename IN ('products', 'product_variants', 'product_images', 'colors', 'sizes')
ORDER BY tablename;

-- Check all policies
SELECT 
    tablename as "Table",
    policyname as "Policy Name",
    cmd as "Command",
    roles as "Roles",
    permissive as "Permissive"
FROM pg_policies
WHERE tablename IN ('products', 'product_variants', 'product_images', 'colors', 'sizes')
ORDER BY tablename, cmd, policyname;

-- Detailed policy check for product_variants
SELECT 
    policyname as "Policy Name",
    cmd as "Command",
    qual as "USING Expression",
    with_check as "WITH CHECK Expression"
FROM pg_policies
WHERE tablename = 'product_variants'
ORDER BY cmd, policyname;



