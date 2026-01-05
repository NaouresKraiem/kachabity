-- ================================================
-- Make Colors and Sizes Completely Public
-- ================================================
-- Anyone can view, create, update, delete colors and sizes
-- No authentication required

-- 1. Disable RLS temporarily
ALTER TABLE colors DISABLE ROW LEVEL SECURITY;
ALTER TABLE sizes DISABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies
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

-- 4. Create PUBLIC policies (everyone can do everything)
-- Colors: anyone can do anything
CREATE POLICY "public_all_colors"
ON colors
FOR ALL
USING (true)
WITH CHECK (true);

-- Sizes: anyone can do anything
CREATE POLICY "public_all_sizes"
ON sizes
FOR ALL
USING (true)
WITH CHECK (true);

-- 5. Verify policies
SELECT 
    tablename,
    policyname,
    roles,
    cmd as operations
FROM pg_policies 
WHERE tablename IN ('colors', 'sizes')
ORDER BY tablename, policyname;



