-- Create shipping_rates table
CREATE TABLE IF NOT EXISTS shipping_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country VARCHAR(100) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    shipping_method VARCHAR(50) NOT NULL DEFAULT 'standard', -- standard, express, overnight
    base_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
    free_shipping_threshold DECIMAL(10, 2), -- null means no free shipping
    estimated_days_min INTEGER DEFAULT 2,
    estimated_days_max INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(country_code, shipping_method)
);

-- Create index for faster lookups
CREATE INDEX idx_shipping_rates_country ON shipping_rates(country_code, is_active);
CREATE INDEX idx_shipping_rates_active ON shipping_rates(is_active);

-- Insert default shipping rates for North African countries
INSERT INTO shipping_rates (country, country_code, shipping_method, base_rate, free_shipping_threshold, estimated_days_min, estimated_days_max, display_order) VALUES
-- Tunisia
('Tunisia', 'TN', 'standard', 7.00, 100.00, 2, 4, 1),
('Tunisia', 'TN', 'express', 12.00, NULL, 1, 2, 2),

-- Algeria
('Algeria', 'DZ', 'standard', 15.00, 150.00, 3, 5, 3),
('Algeria', 'DZ', 'express', 25.00, NULL, 2, 3, 4),

-- Morocco
('Morocco', 'MA', 'standard', 15.00, 150.00, 3, 5, 5),
('Morocco', 'MA', 'express', 25.00, NULL, 2, 3, 6),

-- Libya
('Libya', 'LY', 'standard', 20.00, 200.00, 4, 7, 7),
('Libya', 'LY', 'express', 35.00, NULL, 2, 4, 8),

-- Egypt
('Egypt', 'EG', 'standard', 18.00, 180.00, 4, 6, 9),
('Egypt', 'EG', 'express', 30.00, NULL, 2, 4, 10);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shipping_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_shipping_rates_timestamp
    BEFORE UPDATE ON shipping_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_shipping_rates_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active shipping rates
CREATE POLICY "Anyone can view active shipping rates"
    ON shipping_rates FOR SELECT
    USING (is_active = true);

-- Policy: Only authenticated users can insert (for admin)
CREATE POLICY "Authenticated users can insert shipping rates"
    ON shipping_rates FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: Only authenticated users can update (for admin)
CREATE POLICY "Authenticated users can update shipping rates"
    ON shipping_rates FOR UPDATE
    TO authenticated
    USING (true);

COMMENT ON TABLE shipping_rates IS 'Stores shipping rates by country and method with free shipping thresholds';
COMMENT ON COLUMN shipping_rates.base_rate IS 'Base shipping cost in TND';
COMMENT ON COLUMN shipping_rates.free_shipping_threshold IS 'Order amount for free shipping (NULL = no free shipping available)';
COMMENT ON COLUMN shipping_rates.shipping_method IS 'Shipping method: standard, express, overnight';

