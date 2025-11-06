-- Create site_settings table for dynamic configuration values
CREATE TABLE IF NOT EXISTS public.site_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    free_shipping_threshold INTEGER DEFAULT 500,
    currency TEXT DEFAULT 'DT',
    wallet_name TEXT DEFAULT 'Dasun Wallet',
    support_email TEXT,
    support_phone TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Public read access" ON public.site_settings FOR SELECT USING (true);

-- Create policy for admin updates (you'll need to adjust this based on your auth setup)
CREATE POLICY "Admin update access" ON public.site_settings FOR UPDATE USING (true);

-- Insert default settings (only one row should exist)
INSERT INTO public.site_settings (
    free_shipping_threshold,
    currency,
    wallet_name,
    support_email,
    support_phone
) VALUES (
    500,
    'DT',
    'Dasun Wallet',
    'support@example.com',
    '+216 XX XXX XXX'
) ON CONFLICT DO NOTHING;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_site_settings_timestamp ON public.site_settings;
CREATE TRIGGER update_site_settings_timestamp
    BEFORE UPDATE ON public.site_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_site_settings_updated_at();

-- Verify the settings
SELECT * FROM public.site_settings;

COMMENT ON TABLE public.site_settings IS 'Global site configuration and dynamic values';
COMMENT ON COLUMN public.site_settings.free_shipping_threshold IS 'Minimum order amount for free shipping';
COMMENT ON COLUMN public.site_settings.currency IS 'Site currency code';
COMMENT ON COLUMN public.site_settings.wallet_name IS 'Name of the cashback wallet service';

