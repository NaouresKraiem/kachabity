-- Fix RLS policies for promotions (sale banners) table
-- This script makes the promotions table publicly accessible for CRUD operations

-- Disable RLS temporarily
ALTER TABLE promotions DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Public can view promotions" ON promotions;
DROP POLICY IF EXISTS "Public can insert promotions" ON promotions;
DROP POLICY IF EXISTS "Public can update promotions" ON promotions;
DROP POLICY IF EXISTS "Public can delete promotions" ON promotions;
DROP POLICY IF EXISTS "Service role can manage promotions" ON promotions;
DROP POLICY IF EXISTS "Enable read access for all users" ON promotions;
DROP POLICY IF EXISTS "Enable insert access for all users" ON promotions;
DROP POLICY IF EXISTS "Enable update access for all users" ON promotions;
DROP POLICY IF EXISTS "Enable delete access for all users" ON promotions;

-- Re-enable RLS
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Create public policies (no authentication required)
CREATE POLICY "Public can view promotions"
    ON promotions
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Public can insert promotions"
    ON promotions
    FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Public can update promotions"
    ON promotions
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Public can delete promotions"
    ON promotions
    FOR DELETE
    TO public
    USING (true);

-- Also create policies for service_role (admin operations)
CREATE POLICY "Service role can manage promotions"
    ON promotions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Verify policies
SELECT 
    schemaname,
    tablename, 
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'promotions'
ORDER BY policyname;



