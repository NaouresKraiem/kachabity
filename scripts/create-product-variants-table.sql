-- Create product_variants table
-- This table stores different variants of products (different colors, sizes, etc.)
-- Each variant can have its own images, stock, and price

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color TEXT, -- Color name or hex code (e.g., "Red", "#FF0000")
    size TEXT, -- Size (e.g., "S", "M", "L", "XL")
    sku TEXT UNIQUE, -- Stock Keeping Unit (optional, unique identifier)
    price_cents INTEGER, -- Optional: variant-specific price (if null, use product price)
    stock INTEGER DEFAULT 0, -- Stock for this specific variant
    images JSONB DEFAULT '[]'::jsonb, -- Array of images for this variant
    image_url TEXT, -- Primary image for this variant
    is_active BOOLEAN DEFAULT true, -- Whether this variant is available
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if table already exists (for existing tables)
DO $$ 
BEGIN
    -- Add is_active column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_variants' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE product_variants ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    -- Add other columns that might be missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_variants' 
        AND column_name = 'images'
    ) THEN
        ALTER TABLE product_variants ADD COLUMN images JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_variants' 
        AND column_name = 'image_url'
    ) THEN
        ALTER TABLE product_variants ADD COLUMN image_url TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_variants' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE product_variants ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_variants' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE product_variants ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_color ON product_variants(color);
CREATE INDEX IF NOT EXISTS idx_product_variants_size ON product_variants(size);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_is_active ON product_variants(is_active) WHERE is_active = true;

-- Create a unique constraint to prevent duplicate variants
-- A product can't have the same color+size combination twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_unique 
ON product_variants(product_id, COALESCE(color, ''), COALESCE(size, ''));

-- Add comments for documentation
COMMENT ON TABLE product_variants IS 'Stores product variants with different colors, sizes, images, and stock';
COMMENT ON COLUMN product_variants.color IS 'Color name or hex code for this variant';
COMMENT ON COLUMN product_variants.size IS 'Size for this variant (S, M, L, XL, etc.)';
COMMENT ON COLUMN product_variants.sku IS 'Stock Keeping Unit - unique identifier for this variant';
COMMENT ON COLUMN product_variants.price_cents IS 'Optional variant-specific price. If null, uses product base price';
COMMENT ON COLUMN product_variants.stock IS 'Available stock for this specific variant';
COMMENT ON COLUMN product_variants.images IS 'Array of image objects for this variant (JSONB)';
COMMENT ON COLUMN product_variants.image_url IS 'Primary image URL for this variant';

-- Enable Row Level Security (RLS)
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Create policies for product_variants
-- Allow public read access to active variants
CREATE POLICY "Public can view active product variants"
ON product_variants FOR SELECT
USING (is_active = true);

-- Allow authenticated admins to manage variants
-- Checks user metadata for admin role (set in Supabase Auth > Users > User Metadata)
CREATE POLICY "Admins can manage product variants"
ON product_variants FOR ALL
USING (
    auth.uid() IS NOT NULL 
    AND (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' 
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
    )
);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_variants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_product_variants_updated_at
BEFORE UPDATE ON product_variants
FOR EACH ROW
EXECUTE FUNCTION update_product_variants_updated_at();

SELECT 'Product variants table created successfully!' AS status;

