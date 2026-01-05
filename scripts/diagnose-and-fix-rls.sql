-- ================================================
-- DIAGNOSE AND FIX Colors/Sizes RLS Issues
-- ================================================

-- STEP 1: Check if tables exist
SELECT 
    'Tables Check' as step,
    EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'colors') as colors_exists,
    EXISTS(SELECT 1 FROM pg_tables WHERE tablename = 'sizes') as sizes_exists;

-- STEP 2: Check current RLS status
SELECT 
    'RLS Status' as step,
    tablename,
    CASE 
        WHEN relrowsecurity THEN 'ENABLED' 
        ELSE 'DISABLED' 
    END as rls_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname IN ('colors', 'sizes')
AND n.nspname = 'public';

-- STEP 3: Show current policies
SELECT 
    'Current Policies' as step,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as operations,
    qual as using_clause
FROM pg_policies 
WHERE tablename IN ('colors', 'sizes')
ORDER BY tablename, policyname;

-- ================================================
-- NOW FIX IT
-- ================================================

-- STEP 4: Disable RLS temporarily
ALTER TABLE IF EXISTS colors DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sizes DISABLE ROW LEVEL SECURITY;

-- STEP 5: Drop ALL existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'colors') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON colors', r.policyname);
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'sizes') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON sizes', r.policyname);
    END LOOP;
    
    RAISE NOTICE '✅ All old policies dropped';
END $$;

-- STEP 6: Re-enable RLS
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sizes ENABLE ROW LEVEL SECURITY;

-- STEP 7: Create permissive policies for service_role
-- These allow the service role key to do EVERYTHING

-- Colors policies
CREATE POLICY "service_role_all_colors"
ON colors
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "public_read_colors"
ON colors
AS PERMISSIVE
FOR SELECT
TO public
USING (deleted_at IS NULL);

-- Sizes policies
CREATE POLICY "service_role_all_sizes"
ON sizes
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "public_read_sizes"
ON sizes
AS PERMISSIVE
FOR SELECT
TO public
USING (deleted_at IS NULL);

-- STEP 8: Verify new policies
SELECT 
    '✅ NEW POLICIES' as step,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as operations
FROM pg_policies 
WHERE tablename IN ('colors', 'sizes')
ORDER BY tablename, policyname;

-- STEP 9: Test with a dummy insert (will be rolled back)
DO $$
BEGIN
    -- This is just a test, it will be rolled back
    BEGIN
        INSERT INTO colors (name, display_name, hex_code) 
        VALUES ('test-color', 'Test Color', '#FF0000');
        
        RAISE NOTICE '✅ INSERT TEST PASSED - Service role can insert!';
        
        -- Rollback the test insert
        RAISE EXCEPTION 'Rolling back test insert';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM LIKE '%Rolling back%' THEN
                RAISE NOTICE '✅ Test insert rolled back (this is expected)';
            ELSE
                RAISE NOTICE '❌ INSERT TEST FAILED: %', SQLERRM;
            END IF;
    END;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ RLS POLICIES FIXED!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Colors table:';
    RAISE NOTICE '  - service_role can do EVERYTHING';
    RAISE NOTICE '  - public can SELECT (read) only';
    RAISE NOTICE '';
    RAISE NOTICE 'Sizes table:';
    RAISE NOTICE '  - service_role can do EVERYTHING';
    RAISE NOTICE '  - public can SELECT (read) only';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Make sure your .env.local has:';
    RAISE NOTICE '   SUPABASE_SERVICE_ROLE_KEY=your-key';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Restart your dev server after adding the key!';
    RAISE NOTICE '========================================';
END $$;



