-- Create newsletter_subscribers table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    referrer TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribed_at ON newsletter_subscribers(subscribed_at);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for anyone" ON newsletter_subscribers
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable select for authenticated users only" ON newsletter_subscribers
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON newsletter_subscribers
    FOR UPDATE USING (auth.role() = 'authenticated');

COMMENT ON TABLE newsletter_subscribers IS 'Stores email addresses for newsletter subscriptions';
COMMENT ON COLUMN newsletter_subscribers.status IS 'Subscription status: active, unsubscribed, or bounced';
COMMENT ON COLUMN newsletter_subscribers.metadata IS 'Additional data like source, campaign, preferences';

