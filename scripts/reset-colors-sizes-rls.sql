-- ================================================
-- RESET Colors and Sizes RLS Policies
-- ================================================
-- This script removes all existing policies and creates fresh ones

-- ==========================================
-- 1. DROP ALL EXISTING POLICIES
-- ==========================================

-- Get list of all policies and drop them
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all colors policies
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'colors') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON colors', r.policyname);
    END LOOP;
    
    -- Drop all sizes policies
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'sizes') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON sizes', r.policyname);
    END LOOP;
END $$;

-- ==========================================
-- 2. CREATE SIMPLE POLICIES
-- ==========================================

-- COLORS: Allow public read, service role write
CREATE POLICY "Public can view colors"
ON colors FOR SELECT
TO public
USING (deleted_at IS NULL);

CREATE POLICY "Service role can manage colors"
ON colors FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- SIZES: Allow public read, service role write
CREATE POLICY "Public can view sizes"
ON sizes FOR SELECT
TO public
USING (deleted_at IS NULL);

CREATE POLICY "Service role can manage sizes"
ON sizes FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ==========================================
-- 3. VERIFY POLICIES
-- ==========================================

SELECT 
    tablename,
    policyname,
    roles,
    cmd as operation
FROM pg_policies 
WHERE tablename IN ('colors', 'sizes')
ORDER BY tablename, policyname;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies reset successfully!';
    RAISE NOTICE '✅ Public can read colors and sizes';
    RAISE NOTICE '✅ Service role can manage colors and sizes';
END $$;



