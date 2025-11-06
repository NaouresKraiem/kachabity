-- =====================================================
-- USER FAVORITES (WISHLIST) TABLE
-- =====================================================
-- This table stores user's favorite/saved products
-- Users can save products to view later
-- =====================================================

CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure each user can only favorite a product once
    UNIQUE(user_id, product_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_product_id ON user_favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_created_at ON user_favorites(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own favorites
CREATE POLICY "Users can view own favorites"
    ON user_favorites
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can add their own favorites
CREATE POLICY "Users can insert own favorites"
    ON user_favorites
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own favorites
CREATE POLICY "Users can delete own favorites"
    ON user_favorites
    FOR DELETE
    USING (auth.uid() = user_id);

-- Optional: Add a function to check if product is favorited
CREATE OR REPLACE FUNCTION is_product_favorited(p_product_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_favorites
        WHERE product_id = p_product_id AND user_id = p_user_id
    );
$$;

-- Optional: Add a function to get favorite count for a product
CREATE OR REPLACE FUNCTION get_product_favorite_count(p_product_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT COUNT(*)::INTEGER FROM user_favorites
    WHERE product_id = p_product_id;
$$;

