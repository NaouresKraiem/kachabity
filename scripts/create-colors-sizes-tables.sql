-- ================================================
-- Create Colors and Sizes Tables with RLS Policies
-- ================================================
-- Run this script in your Supabase SQL Editor
-- This creates the colors and sizes tables needed for product variants

-- ==========================================
-- 1. CREATE COLORS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    hex_code TEXT,
    rgb_code TEXT,
    display_name TEXT,
    sort_order INTEGER DEFAULT 0,
    description TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_colors_deleted_at ON colors(deleted_at);
CREATE INDEX IF NOT EXISTS idx_colors_sort_order ON colors(sort_order);

-- Add comments for documentation
COMMENT ON TABLE colors IS 'Stores product color variants';
COMMENT ON COLUMN colors.name IS 'Internal name (lowercase with dashes)';
COMMENT ON COLUMN colors.display_name IS 'Customer-facing display name';
COMMENT ON COLUMN colors.hex_code IS 'Hex color code (e.g., #FF0000)';
COMMENT ON COLUMN colors.deleted_at IS 'Soft delete timestamp';

-- ==========================================
-- 2. CREATE SIZES TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    display_name TEXT,
    sort_order INTEGER DEFAULT 0,
    description TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_sizes_deleted_at ON sizes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_sizes_sort_order ON sizes(sort_order);

-- Add comments for documentation
COMMENT ON TABLE sizes IS 'Stores product size variants';
COMMENT ON COLUMN sizes.name IS 'Internal name (usually uppercase, e.g., S, M, L)';
COMMENT ON COLUMN sizes.display_name IS 'Customer-facing display name (e.g., Small, Medium, Large)';
COMMENT ON COLUMN sizes.deleted_at IS 'Soft delete timestamp';

-- ==========================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sizes ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. DROP EXISTING POLICIES (if any)
-- ==========================================

DROP POLICY IF EXISTS "Public can view active colors" ON colors;
DROP POLICY IF EXISTS "Admins can manage colors" ON colors;
DROP POLICY IF EXISTS "Public can view active sizes" ON sizes;
DROP POLICY IF EXISTS "Admins can manage sizes" ON sizes;

-- ==========================================
-- 5. CREATE RLS POLICIES FOR COLORS
-- ==========================================

-- Allow public read access to non-deleted colors
CREATE POLICY "Public can view active colors"
ON colors FOR SELECT
USING (deleted_at IS NULL);

-- Allow admins full access to colors (insert, update, delete)
CREATE POLICY "Admins can manage colors"
ON colors FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' 
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' 
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
    )
);

-- ==========================================
-- 6. CREATE RLS POLICIES FOR SIZES
-- ==========================================

-- Allow public read access to non-deleted sizes
CREATE POLICY "Public can view active sizes"
ON sizes FOR SELECT
USING (deleted_at IS NULL);

-- Allow admins full access to sizes (insert, update, delete)
CREATE POLICY "Admins can manage sizes"
ON sizes FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' 
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' 
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
    )
);

-- ==========================================
-- 7. CREATE TRIGGERS FOR UPDATED_AT
-- ==========================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_colors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_sizes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_colors_updated_at ON colors;
DROP TRIGGER IF EXISTS update_sizes_updated_at ON sizes;

-- Create triggers
CREATE TRIGGER update_colors_updated_at
    BEFORE UPDATE ON colors
    FOR EACH ROW
    EXECUTE FUNCTION update_colors_updated_at();

CREATE TRIGGER update_sizes_updated_at
    BEFORE UPDATE ON sizes
    FOR EACH ROW
    EXECUTE FUNCTION update_sizes_updated_at();

-- ==========================================
-- 8. GRANT PERMISSIONS
-- ==========================================

-- Grant usage on sequences (if any auto-increment columns exist)
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ==========================================
-- SUCCESS MESSAGE
-- ==========================================

DO $$
BEGIN
    RAISE NOTICE '✅ Colors and Sizes tables created successfully!';
    RAISE NOTICE '✅ RLS policies configured for admin access';
    RAISE NOTICE '✅ Public can view active colors and sizes';
    RAISE NOTICE '✅ Admins can create, update, and delete colors/sizes';
    RAISE NOTICE '';
    RAISE NOTICE '🔐 Make sure your admin user has the "admin" or "super_admin" role set in user_metadata';
    RAISE NOTICE 'To set admin role, run: UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || ''{"role": "admin"}'' WHERE email = ''your-email@example.com'';';
END $$;



