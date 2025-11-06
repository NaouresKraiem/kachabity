-- Create or update site_settings table to include shipping settings
-- If the table doesn't exist, create it
CREATE TABLE IF NOT EXISTS site_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(50) NOT NULL DEFAULT 'string', -- string, number, boolean, json
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    is_public BOOLEAN DEFAULT false, -- Can be accessed by frontend
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_site_settings_public ON site_settings(is_public);

-- Insert shipping-related settings
INSERT INTO site_settings (setting_key, setting_value, setting_type, description, category, is_public) VALUES
('global_free_shipping_threshold', '500', 'number', 'Global free shipping threshold in TND. Orders above this amount get free shipping.', 'shipping', true),
('free_shipping_enabled', 'true', 'boolean', 'Enable or disable free shipping globally', 'shipping', true),
('default_shipping_cost', '7', 'number', 'Default shipping cost when country rate is not found', 'shipping', true),
('shipping_tax_rate', '0', 'number', 'Tax rate applied to shipping (0-1, e.g., 0.19 for 19%)', 'shipping', false),
('general_tax_rate', '0.19', 'number', 'General tax rate applied to orders (e.g., 0.19 for 19% TVA)', 'tax', true)
ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_at = NOW();

-- Update shipping_rates table - make country threshold optional (can be NULL to use global)
-- This allows country-specific overrides if needed
COMMENT ON COLUMN shipping_rates.free_shipping_threshold IS 'Country-specific free shipping threshold. NULL means use global threshold from site_settings.';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_site_settings_timestamp ON site_settings;
CREATE TRIGGER update_site_settings_timestamp
    BEFORE UPDATE ON site_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_site_settings_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read public settings
CREATE POLICY "Anyone can view public site settings"
    ON site_settings FOR SELECT
    USING (is_public = true);

-- Policy: Only authenticated users can update (for admin)
CREATE POLICY "Authenticated users can update site settings"
    ON site_settings FOR UPDATE
    TO authenticated
    USING (true);

-- Policy: Only authenticated users can insert
CREATE POLICY "Authenticated users can insert site settings"
    ON site_settings FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Helper function to get setting value
CREATE OR REPLACE FUNCTION get_site_setting(key TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    SELECT setting_value INTO result
    FROM site_settings
    WHERE setting_key = key;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get numeric setting
CREATE OR REPLACE FUNCTION get_site_setting_number(key TEXT)
RETURNS NUMERIC AS $$
DECLARE
    result NUMERIC;
BEGIN
    SELECT setting_value::NUMERIC INTO result
    FROM site_settings
    WHERE setting_key = key AND setting_type = 'number';
    
    RETURN COALESCE(result, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing shipping rates to use NULL (global threshold)
-- Keep Tunisia with specific threshold as example
UPDATE shipping_rates 
SET free_shipping_threshold = NULL
WHERE country_code != 'TN';

COMMENT ON TABLE site_settings IS 'Global site configuration settings that can be changed without code deployment';
COMMENT ON COLUMN site_settings.is_public IS 'If true, this setting can be accessed by unauthenticated users (frontend)';

-- Example: How to change the global free shipping threshold
-- UPDATE site_settings SET setting_value = '600' WHERE setting_key = 'global_free_shipping_threshold';

-- Example: Disable free shipping temporarily
-- UPDATE site_settings SET setting_value = 'false' WHERE setting_key = 'free_shipping_enabled';

