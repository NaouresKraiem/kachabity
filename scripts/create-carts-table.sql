-- =====================================================
-- E-COMMERCE CART SYSTEM - DATABASE SCHEMA
-- =====================================================
-- This creates a comprehensive cart system that supports:
-- 1. Authenticated users (linked to auth.users)
-- 2. Guest users (session-based)
-- 3. Cart analytics and abandoned cart tracking
-- 4. Automatic cleanup of old carts
-- =====================================================

-- 1. CARTS TABLE
-- Stores cart metadata for each user or guest session
CREATE TABLE IF NOT EXISTS carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT UNIQUE, -- For guest users (before login)
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'abandoned', 'converted', 'merged')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 days',
    converted_to_order_id UUID, -- Track if cart became an order
    device_info JSONB, -- Store device/browser info for analytics
    CONSTRAINT user_or_session CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- 2. CART_ITEMS TABLE
-- Stores individual products in each cart
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID REFERENCES carts(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_add DECIMAL(10, 2), -- Store price when added (for analytics)
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cart_id, product_id) -- One product can only appear once per cart
);

-- 3. ABANDONED_CARTS VIEW
-- For marketing: find carts abandoned for 1+ hours
CREATE OR REPLACE VIEW abandoned_carts AS
SELECT 
    c.id,
    c.user_id,
    c.session_id,
    c.last_activity_at,
    c.created_at,
    COUNT(ci.id) as item_count,
    SUM(ci.quantity * ci.price_at_add) as estimated_value,
    ARRAY_AGG(
        jsonb_build_object(
            'product_id', ci.product_id,
            'quantity', ci.quantity,
            'price', ci.price_at_add
        )
    ) as items
FROM carts c
LEFT JOIN cart_items ci ON c.id = ci.cart_id
WHERE 
    c.status = 'active'
    AND c.last_activity_at < NOW() - INTERVAL '1 hour'
    AND c.last_activity_at > NOW() - INTERVAL '30 days'
    AND c.user_id IS NOT NULL -- Only for registered users (can email them)
GROUP BY c.id, c.user_id, c.session_id, c.last_activity_at, c.created_at;

-- 4. CART_ANALYTICS VIEW
-- For admin dashboard: cart statistics
CREATE OR REPLACE VIEW cart_analytics AS
SELECT 
    DATE(c.created_at) as date,
    COUNT(DISTINCT c.id) as total_carts,
    COUNT(DISTINCT CASE WHEN c.status = 'converted' THEN c.id END) as converted_carts,
    COUNT(DISTINCT CASE WHEN c.status = 'abandoned' THEN c.id END) as abandoned_carts,
    AVG(cart_totals.item_count) as avg_items_per_cart,
    AVG(cart_totals.total_value) as avg_cart_value
FROM carts c
LEFT JOIN (
    SELECT 
        cart_id,
        COUNT(*) as item_count,
        SUM(quantity * price_at_add) as total_value
    FROM cart_items
    GROUP BY cart_id
) cart_totals ON c.id = cart_totals.cart_id
GROUP BY DATE(c.created_at)
ORDER BY date DESC;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Fast lookup by user
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);

-- Fast lookup by session (guest users)
CREATE INDEX IF NOT EXISTS idx_carts_session_id ON carts(session_id);

-- Find active carts quickly
CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status);

-- Find abandoned carts
CREATE INDEX IF NOT EXISTS idx_carts_last_activity ON carts(last_activity_at) WHERE status = 'active';

-- Fast cart item lookups
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- =====================================================
-- TRIGGERS FOR AUTOMATION
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_carts_updated_at 
    BEFORE UPDATE ON carts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at 
    BEFORE UPDATE ON cart_items 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Update cart's last_activity_at when items change
CREATE OR REPLACE FUNCTION update_cart_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE carts 
    SET last_activity_at = NOW()
    WHERE id = COALESCE(NEW.cart_id, OLD.cart_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cart_activity_on_item_change
    AFTER INSERT OR UPDATE OR DELETE ON cart_items
    FOR EACH ROW
    EXECUTE FUNCTION update_cart_activity();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Users can only see their own carts
CREATE POLICY "Users can view their own carts"
    ON carts FOR SELECT
    USING (
        auth.uid() = user_id 
        OR session_id = current_setting('app.session_id', TRUE)
    );

-- Users can insert their own carts
CREATE POLICY "Users can create their own carts"
    ON carts FOR INSERT
    WITH CHECK (
        auth.uid() = user_id 
        OR session_id = current_setting('app.session_id', TRUE)
    );

-- Users can update their own carts
CREATE POLICY "Users can update their own carts"
    ON carts FOR UPDATE
    USING (
        auth.uid() = user_id 
        OR session_id = current_setting('app.session_id', TRUE)
    );

-- Users can delete their own carts
CREATE POLICY "Users can delete their own carts"
    ON carts FOR DELETE
    USING (
        auth.uid() = user_id 
        OR session_id = current_setting('app.session_id', TRUE)
    );

-- Cart items inherit cart permissions
CREATE POLICY "Users can view their cart items"
    ON cart_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM carts 
            WHERE carts.id = cart_items.cart_id 
            AND (
                carts.user_id = auth.uid() 
                OR carts.session_id = current_setting('app.session_id', TRUE)
            )
        )
    );

CREATE POLICY "Users can manage their cart items"
    ON cart_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM carts 
            WHERE carts.id = cart_items.cart_id 
            AND (
                carts.user_id = auth.uid() 
                OR carts.session_id = current_setting('app.session_id', TRUE)
            )
        )
    );

-- =====================================================
-- CLEANUP FUNCTION
-- =====================================================

-- Function to mark old carts as abandoned and delete expired ones
CREATE OR REPLACE FUNCTION cleanup_old_carts()
RETURNS void AS $$
BEGIN
    -- Mark carts as abandoned if inactive for 24 hours
    UPDATE carts
    SET status = 'abandoned'
    WHERE status = 'active'
        AND last_activity_at < NOW() - INTERVAL '24 hours';
    
    -- Delete expired guest carts (30+ days old)
    DELETE FROM carts
    WHERE expires_at < NOW()
        AND session_id IS NOT NULL
        AND status IN ('abandoned', 'active');
    
    -- Keep abandoned carts for registered users (for recovery emails)
    -- but delete after 90 days
    DELETE FROM carts
    WHERE created_at < NOW() - INTERVAL '90 days'
        AND status = 'abandoned'
        AND user_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- HELPER FUNCTIONS FOR YOUR APP
-- =====================================================

-- Function to merge guest cart with user cart after login
CREATE OR REPLACE FUNCTION merge_guest_cart_to_user(
    p_session_id TEXT,
    p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_guest_cart_id UUID;
    v_user_cart_id UUID;
    v_item RECORD;
BEGIN
    -- Find guest cart
    SELECT id INTO v_guest_cart_id
    FROM carts
    WHERE session_id = p_session_id
        AND status = 'active';
    
    IF v_guest_cart_id IS NULL THEN
        RETURN NULL; -- No guest cart to merge
    END IF;
    
    -- Find or create user cart
    SELECT id INTO v_user_cart_id
    FROM carts
    WHERE user_id = p_user_id
        AND status = 'active'
    LIMIT 1;
    
    IF v_user_cart_id IS NULL THEN
        -- Create new cart for user
        INSERT INTO carts (user_id, status)
        VALUES (p_user_id, 'active')
        RETURNING id INTO v_user_cart_id;
    END IF;
    
    -- Merge items from guest cart to user cart
    FOR v_item IN 
        SELECT product_id, quantity, price_at_add
        FROM cart_items
        WHERE cart_id = v_guest_cart_id
    LOOP
        INSERT INTO cart_items (cart_id, product_id, quantity, price_at_add)
        VALUES (v_user_cart_id, v_item.product_id, v_item.quantity, v_item.price_at_add)
        ON CONFLICT (cart_id, product_id) 
        DO UPDATE SET 
            quantity = cart_items.quantity + v_item.quantity,
            updated_at = NOW();
    END LOOP;
    
    -- Mark guest cart as merged
    UPDATE carts
    SET status = 'merged'
    WHERE id = v_guest_cart_id;
    
    RETURN v_user_cart_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INITIAL DATA / COMMENTS
-- =====================================================

COMMENT ON TABLE carts IS 'Stores shopping cart data for both authenticated and guest users';
COMMENT ON TABLE cart_items IS 'Individual products in each shopping cart';
COMMENT ON VIEW abandoned_carts IS 'Carts abandoned for 1+ hours with registered users (for email campaigns)';
COMMENT ON VIEW cart_analytics IS 'Daily cart statistics for admin dashboard';
COMMENT ON FUNCTION merge_guest_cart_to_user IS 'Merges guest cart into user cart after login';
COMMENT ON FUNCTION cleanup_old_carts IS 'Run daily to mark abandoned carts and delete expired ones';

-- =====================================================
-- DONE! 
-- =====================================================
-- Run this in Supabase SQL Editor
-- Then set up a cron job to run cleanup_old_carts() daily

