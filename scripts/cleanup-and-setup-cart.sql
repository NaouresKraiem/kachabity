-- =====================================================
-- CLEANUP AND FRESH CART SETUP
-- =====================================================
-- This script safely removes any partial cart setup and 
-- creates everything fresh (works with existing database)
-- =====================================================

-- 1. DROP EXISTING CART-SPECIFIC OBJECTS (if they exist)
-- =====================================================

-- Drop cart-specific triggers (but keep shared functions!)
DROP TRIGGER IF EXISTS update_carts_updated_at ON carts;
DROP TRIGGER IF EXISTS update_cart_items_updated_at ON cart_items;
DROP TRIGGER IF EXISTS update_cart_activity_on_item_change ON cart_items;

-- Drop cart-specific functions only
DROP FUNCTION IF EXISTS update_cart_activity();
DROP FUNCTION IF EXISTS cleanup_old_carts();
DROP FUNCTION IF EXISTS merge_guest_cart_to_user(TEXT, UUID);

-- Drop views
DROP VIEW IF EXISTS abandoned_carts;
DROP VIEW IF EXISTS cart_analytics;

-- Drop policies
DROP POLICY IF EXISTS "Users can view their own carts" ON carts;
DROP POLICY IF EXISTS "Users can create their own carts" ON carts;
DROP POLICY IF EXISTS "Users can update their own carts" ON carts;
DROP POLICY IF EXISTS "Users can delete their own carts" ON carts;
DROP POLICY IF EXISTS "Users can view their cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can manage their cart items" ON cart_items;

-- Drop tables (CASCADE removes dependent objects)
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS carts CASCADE;

-- =====================================================
-- 2. CREATE TABLES
-- =====================================================

-- CARTS TABLE
CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT UNIQUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'abandoned', 'converted', 'merged')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 days',
    converted_to_order_id UUID,
    device_info JSONB,
    CONSTRAINT user_or_session CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- CART_ITEMS TABLE
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID REFERENCES carts(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_add DECIMAL(10, 2),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cart_id, product_id)
);

-- =====================================================
-- 3. CREATE INDEXES
-- =====================================================

CREATE INDEX idx_carts_user_id ON carts(user_id);
CREATE INDEX idx_carts_session_id ON carts(session_id);
CREATE INDEX idx_carts_status ON carts(status);
CREATE INDEX idx_carts_last_activity ON carts(last_activity_at) WHERE status = 'active';
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);

-- =====================================================
-- 4. CREATE SHARED FUNCTION (if not exists)
-- =====================================================

-- Create the shared function only if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'update_updated_at_column'
    ) THEN
        CREATE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $func$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $func$ language 'plpgsql';
    END IF;
END
$$;

-- =====================================================
-- 5. CREATE TRIGGERS
-- =====================================================

-- Apply to carts table
CREATE TRIGGER update_carts_updated_at 
    BEFORE UPDATE ON carts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to cart_items table
CREATE TRIGGER update_cart_items_updated_at 
    BEFORE UPDATE ON cart_items 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update cart activity
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
-- 6. CREATE VIEWS
-- =====================================================

-- Abandoned carts view
CREATE VIEW abandoned_carts AS
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
    AND c.user_id IS NOT NULL
GROUP BY c.id, c.user_id, c.session_id, c.last_activity_at, c.created_at;

-- Cart analytics view
CREATE VIEW cart_analytics AS
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
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Cleanup old carts
CREATE OR REPLACE FUNCTION cleanup_old_carts()
RETURNS void AS $$
BEGIN
    UPDATE carts
    SET status = 'abandoned'
    WHERE status = 'active'
        AND last_activity_at < NOW() - INTERVAL '24 hours';
    
    DELETE FROM carts
    WHERE expires_at < NOW()
        AND session_id IS NOT NULL
        AND status IN ('abandoned', 'active');
    
    DELETE FROM carts
    WHERE created_at < NOW() - INTERVAL '90 days'
        AND status = 'abandoned'
        AND user_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Merge guest cart with user cart
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
    SELECT id INTO v_guest_cart_id
    FROM carts
    WHERE session_id = p_session_id
        AND status = 'active';
    
    IF v_guest_cart_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    SELECT id INTO v_user_cart_id
    FROM carts
    WHERE user_id = p_user_id
        AND status = 'active'
    LIMIT 1;
    
    IF v_user_cart_id IS NULL THEN
        INSERT INTO carts (user_id, status)
        VALUES (p_user_id, 'active')
        RETURNING id INTO v_user_cart_id;
    END IF;
    
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
    
    UPDATE carts
    SET status = 'merged'
    WHERE id = v_guest_cart_id;
    
    RETURN v_user_cart_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own carts"
    ON carts FOR SELECT
    USING (
        auth.uid() = user_id 
        OR session_id IS NOT NULL
    );

CREATE POLICY "Users can create their own carts"
    ON carts FOR INSERT
    WITH CHECK (
        auth.uid() = user_id 
        OR session_id IS NOT NULL
    );

CREATE POLICY "Users can update their own carts"
    ON carts FOR UPDATE
    USING (
        auth.uid() = user_id 
        OR session_id IS NOT NULL
    );

CREATE POLICY "Users can delete their own carts"
    ON carts FOR DELETE
    USING (
        auth.uid() = user_id 
        OR session_id IS NOT NULL
    );

CREATE POLICY "Users can view their cart items"
    ON cart_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM carts 
            WHERE carts.id = cart_items.cart_id 
            AND (
                carts.user_id = auth.uid() 
                OR carts.session_id IS NOT NULL
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
                OR carts.session_id IS NOT NULL
            )
        )
    );

-- =====================================================
-- ✅ DONE! Cart tables are ready!
-- =====================================================

-- Verify installation
SELECT '✅ Tables created:' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('carts', 'cart_items')
ORDER BY table_name;

SELECT '✅ Views created:' as status;
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name IN ('abandoned_carts', 'cart_analytics')
ORDER BY table_name;

SELECT '✅ Setup complete! Your cart system is ready.' as status;
