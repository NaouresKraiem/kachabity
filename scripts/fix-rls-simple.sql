-- ================================================
-- SIMPLE FIX for Colors/Sizes RLS
-- ================================================
-- Run this entire script in Supabase SQL Editor

-- 1. Disable RLS temporarily
ALTER TABLE colors DISABLE ROW LEVEL SECURITY;
ALTER TABLE sizes DISABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies (one by one to avoid errors)
DROP POLICY IF EXISTS "Public can view colors" ON colors;
DROP POLICY IF EXISTS "Public can view active colors" ON colors;
DROP POLICY IF EXISTS "Admins can manage colors" ON colors;
DROP POLICY IF EXISTS "Service role can manage colors" ON colors;
DROP POLICY IF EXISTS "service_role_all_colors" ON colors;
DROP POLICY IF EXISTS "public_read_colors" ON colors;
DROP POLICY IF EXISTS "Authenticated users can insert colors" ON colors;
DROP POLICY IF EXISTS "Authenticated users can update colors" ON colors;
DROP POLICY IF EXISTS "Authenticated users can delete colors" ON colors;

DROP POLICY IF EXISTS "Public can view sizes" ON sizes;
DROP POLICY IF EXISTS "Public can view active sizes" ON sizes;
DROP POLICY IF EXISTS "Admins can manage sizes" ON sizes;
DROP POLICY IF EXISTS "Service role can manage sizes" ON sizes;
DROP POLICY IF EXISTS "service_role_all_sizes" ON sizes;
DROP POLICY IF EXISTS "public_read_sizes" ON sizes;
DROP POLICY IF EXISTS "Authenticated users can insert sizes" ON sizes;
DROP POLICY IF EXISTS "Authenticated users can update sizes" ON sizes;
DROP POLICY IF EXISTS "Authenticated users can delete sizes" ON sizes;

-- 3. Re-enable RLS
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sizes ENABLE ROW LEVEL SECURITY;

-- 4. Create new simple policies
-- Colors: service_role can do everything
CREATE POLICY "service_role_all_colors"
ON colors
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Colors: public can read non-deleted
CREATE POLICY "public_read_colors"
ON colors
FOR SELECT
TO public
USING (deleted_at IS NULL);

-- Sizes: service_role can do everything
CREATE POLICY "service_role_all_sizes"
ON sizes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Sizes: public can read non-deleted
CREATE POLICY "public_read_sizes"
ON sizes
FOR SELECT
TO public
USING (deleted_at IS NULL);

-- 5. Verify policies were created
SELECT 
    tablename,
    policyname,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN ('colors', 'sizes')
ORDER BY tablename, policyname;



