-- Create product_images table if it doesn't exist
-- Matches the structure expected by the application code
CREATE TABLE IF NOT EXISTS product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    is_main BOOLEAN DEFAULT false,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Public can view product images" ON product_images;
DROP POLICY IF EXISTS "Authenticated users can manage product images" ON product_images;
DROP POLICY IF EXISTS "Enable read access for all users" ON product_images;
DROP POLICY IF EXISTS "Enable insert for all users" ON product_images;
DROP POLICY IF EXISTS "Enable update for all users" ON product_images;
DROP POLICY IF EXISTS "Enable delete for all users" ON product_images;

-- Policy for SELECT (read) - Allow everyone to read images
CREATE POLICY "Public can view product images"
ON product_images FOR SELECT
USING (true);

-- Policy for ALL (insert/update/delete) - Allow authenticated users (admins)
-- If you are using the service_role key, it bypasses RLS anyway.
-- But if using the anon key with a user token, this is needed.
CREATE POLICY "Authenticated users can manage product images"
ON product_images FOR ALL
USING (auth.role() = 'authenticated');

-- Verify columns exist (in case table existed with different schema)
DO $$ 
BEGIN
    -- Add is_main if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_images' AND column_name = 'is_main') THEN
        ALTER TABLE product_images ADD COLUMN is_main BOOLEAN DEFAULT false;
    END IF;

    -- Add position if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_images' AND column_name = 'position') THEN
        ALTER TABLE product_images ADD COLUMN position INTEGER DEFAULT 0;
    END IF;

    -- Add variant_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_images' AND column_name = 'variant_id') THEN
        ALTER TABLE product_images ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE;
    END IF;
END $$;

SELECT '✅ product_images table and RLS policies configured successfully!' AS status;


