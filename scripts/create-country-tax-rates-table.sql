-- Country-specific tax rates table
-- This allows different tax rates for different countries

CREATE TABLE IF NOT EXISTS country_tax_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country VARCHAR(100) NOT NULL,
    country_code VARCHAR(3) NOT NULL,
    tax_rate DECIMAL(5,4) NOT NULL, -- e.g., 0.19 for 19%
    tax_name VARCHAR(50), -- e.g., "TVA", "VAT", "GST"
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(country_code)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_country_tax_rates_code ON country_tax_rates(country_code);
CREATE INDEX IF NOT EXISTS idx_country_tax_rates_active ON country_tax_rates(is_active);

-- Insert North African country tax rates
INSERT INTO country_tax_rates (country, country_code, tax_rate, tax_name, description) VALUES
('Tunisia', 'TN', 0.19, 'TVA', 'Taxe sur la Valeur Ajoutée - Standard rate for most goods'),
('Algeria', 'DZ', 0.19, 'TVA', 'Taxe sur la Valeur Ajoutée - Standard rate'),
('Morocco', 'MA', 0.20, 'TVA', 'Taxe sur la Valeur Ajoutée - Standard rate'),
('Libya', 'LY', 0.00, 'N/A', 'No VAT system currently in place'),
('Egypt', 'EG', 0.14, 'VAT', 'Value Added Tax - Standard rate')
ON CONFLICT (country_code) DO UPDATE SET
    tax_rate = EXCLUDED.tax_rate,
    tax_name = EXCLUDED.tax_name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Enable RLS
ALTER TABLE country_tax_rates ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to active tax rates"
    ON country_tax_rates FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- Create policies for authenticated users to read all
CREATE POLICY "Allow authenticated full read access"
    ON country_tax_rates FOR SELECT
    TO authenticated
    USING (true);

-- Create policies for admin updates (adjust based on your auth setup)
CREATE POLICY "Allow authenticated users to update tax rates"
    ON country_tax_rates FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert tax rates"
    ON country_tax_rates FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_country_tax_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_country_tax_rates_timestamp ON country_tax_rates;
CREATE TRIGGER update_country_tax_rates_timestamp
    BEFORE UPDATE ON country_tax_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_country_tax_rates_updated_at();

-- Add comments for documentation
COMMENT ON TABLE country_tax_rates IS 'Store country-specific tax rates for international orders';
COMMENT ON COLUMN country_tax_rates.tax_rate IS 'Tax rate as decimal (0.19 = 19%)';
COMMENT ON COLUMN country_tax_rates.country_code IS 'ISO 3166-1 alpha-2 country code';

