-- Fix RLS policies for promotions table (Sale Banners)
-- This allows public management of sale banners without authentication

-- 1. Disable RLS temporarily
ALTER TABLE promotions DISABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies
DROP POLICY IF EXISTS "Public can view promotions" ON promotions;
DROP POLICY IF EXISTS "Public can insert promotions" ON promotions;
DROP POLICY IF EXISTS "Public can update promotions" ON promotions;
DROP POLICY IF EXISTS "Public can delete promotions" ON promotions;
DROP POLICY IF EXISTS "Service role can manage promotions" ON promotions;
DROP POLICY IF EXISTS "Anyone can manage promotions" ON promotions;

-- 3. Re-enable RLS
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- 4. Create new public policies (anyone can manage)
CREATE POLICY "Public can view promotions"
ON promotions FOR SELECT
TO public
USING (true);

CREATE POLICY "Public can insert promotions"
ON promotions FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Public can update promotions"
ON promotions FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Public can delete promotions"
ON promotions FOR DELETE
TO public
USING (true);

-- 5. Also add service_role policies for good measure
CREATE POLICY "Service role can manage promotions"
ON promotions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 6. Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'promotions'
ORDER BY policyname;
