-- ================================================
-- SIMPLE FIX: Allow authenticated users to manage colors/sizes
-- ================================================
-- This is a simpler approach that allows any authenticated user
-- to manage colors and sizes (good for admin-only applications)

-- DROP existing policies
DROP POLICY IF EXISTS "Public can view active colors" ON colors;
DROP POLICY IF EXISTS "Admins can manage colors" ON colors;
DROP POLICY IF EXISTS "Public can view active sizes" ON sizes;
DROP POLICY IF EXISTS "Admins can manage sizes" ON sizes;

-- ==========================================
-- COLORS POLICIES (SIMPLE)
-- ==========================================

-- Allow everyone to view non-deleted colors
CREATE POLICY "Public can view colors"
ON colors FOR SELECT
USING (deleted_at IS NULL);

-- Allow authenticated users to insert colors
CREATE POLICY "Authenticated users can insert colors"
ON colors FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update colors
CREATE POLICY "Authenticated users can update colors"
ON colors FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete colors
CREATE POLICY "Authenticated users can delete colors"
ON colors FOR DELETE
TO authenticated
USING (true);

-- ==========================================
-- SIZES POLICIES (SIMPLE)
-- ==========================================

-- Allow everyone to view non-deleted sizes
CREATE POLICY "Public can view sizes"
ON sizes FOR SELECT
USING (deleted_at IS NULL);

-- Allow authenticated users to insert sizes
CREATE POLICY "Authenticated users can insert sizes"
ON sizes FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update sizes
CREATE POLICY "Authenticated users can update sizes"
ON sizes FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete sizes
CREATE POLICY "Authenticated users can delete sizes"
ON sizes FOR DELETE
TO authenticated
USING (true);

-- ==========================================
-- VERIFY POLICIES
-- ==========================================

DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies updated successfully!';
    RAISE NOTICE '✅ All authenticated users can now manage colors and sizes';
    RAISE NOTICE '✅ Public users can view active colors and sizes';
    RAISE NOTICE '';
    RAISE NOTICE '🔓 Note: This allows ANY logged-in user to manage variants';
    RAISE NOTICE '🔐 For production, you may want to restrict to admin role only';
END $$;

-- Check current policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN ('colors', 'sizes')
ORDER BY tablename, policyname;



