-- Fix Row Level Security (RLS) for products table
-- Run this in Supabase SQL Editor

-- Option 1: Disable RLS completely (Simple - Good for development/admin only)
ALTER TABLE products DISABLE ROW LEVEL SECURITY;

-- If you want to keep RLS enabled, use Option 2 instead:
-- Option 2: Add policies to allow public access (Comment out Option 1 if using this)

-- First, enable RLS if not already enabled
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT (read) - Allow everyone to read products
-- CREATE POLICY "Enable read access for all users" ON products
--     FOR SELECT USING (true);

-- Policy for INSERT (create) - Allow anyone to insert (for admin)
-- CREATE POLICY "Enable insert for all users" ON products
--     FOR INSERT WITH CHECK (true);

-- Policy for UPDATE (edit) - Allow anyone to update (for admin)
-- CREATE POLICY "Enable update for all users" ON products
--     FOR UPDATE USING (true) WITH CHECK (true);

-- Policy for DELETE - Allow anyone to delete (for admin)
-- CREATE POLICY "Enable delete for all users" ON products
--     FOR DELETE USING (true);

-- Verify RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE tablename = 'products';

SELECT '✅ RLS policies fixed! You can now insert products.' AS status;



