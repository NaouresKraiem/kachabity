-- =====================================================
-- Step 1: Cleanup Products Table
-- =====================================================
-- Remove unnecessary columns and keep only:
-- - id, name, slug, description, category_id, base_price, status, deleted_at
-- Plus standard timestamps: created_at, updated_at
-- =====================================================

-- Step 1.1: Create product_status enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_status') THEN
        CREATE TYPE product_status AS ENUM ('active', 'inactive', 'archived');
    END IF;
END $$;

-- Step 1.2: Add missing required columns
DO $$ 
BEGIN
    -- Add 'name' column (rename from 'title' if it exists)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'name'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'title'
        ) THEN
            ALTER TABLE products RENAME COLUMN title TO name;
        ELSE
            ALTER TABLE products ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT '';
        END IF;
    END IF;

    -- Add 'slug' column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'slug'
    ) THEN
        ALTER TABLE products ADD COLUMN slug VARCHAR(255);
        -- Generate slugs from names
        UPDATE products 
        SET slug = LOWER(REGEXP_REPLACE(COALESCE(name, 'product'), '[^a-zA-Z0-9]+', '-', 'g'))
        WHERE slug IS NULL OR slug = '';
        ALTER TABLE products ALTER COLUMN slug SET NOT NULL;
    END IF;

    -- Add 'description' column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'description'
    ) THEN
        ALTER TABLE products ADD COLUMN description TEXT;
    END IF;

    -- Add 'category_id' column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'category_id'
    ) THEN
        ALTER TABLE products ADD COLUMN category_id UUID;
    END IF;

    -- Add 'base_price' column (convert from price_cents if exists)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'base_price'
    ) THEN
        ALTER TABLE products ADD COLUMN base_price DECIMAL(10, 2);
        
        -- Convert from price_cents if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'price_cents'
        ) THEN
            UPDATE products 
            SET base_price = CASE 
                WHEN price_cents IS NULL THEN 0
                WHEN price_cents::text ~ '^[0-9]+\.?[0-9]*$' 
                THEN (price_cents::text::DECIMAL) / 100.0 
                ELSE 0 
            END;
        ELSE
            UPDATE products SET base_price = 0 WHERE base_price IS NULL;
        END IF;
        
        ALTER TABLE products ALTER COLUMN base_price SET DEFAULT 0;
        ALTER TABLE products ALTER COLUMN base_price SET NOT NULL;
    END IF;

    -- Add 'status' column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'status'
    ) THEN
        ALTER TABLE products ADD COLUMN status product_status NOT NULL DEFAULT 'active';
    END IF;

    -- Add 'deleted_at' column (soft delete)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE products ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE NULL;
    END IF;

    -- Add 'created_at' if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE products ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    -- Add 'updated_at' if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE products ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Step 1.3: Remove unnecessary columns
-- List of columns to KEEP: id, name, slug, description, category_id, base_price, status, deleted_at, created_at, updated_at
-- Remove everything else

DO $$ 
DECLARE
    col_name TEXT;
BEGIN
    -- Drop columns that are not in the required list
    FOR col_name IN 
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND table_schema = 'public'
        AND column_name NOT IN (
            'id', 
            'name', 
            'slug', 
            'description', 
            'category_id', 
            'base_price', 
            'status', 
            'deleted_at',
            'created_at',
            'updated_at'
        )
    LOOP
        EXECUTE format('ALTER TABLE products DROP COLUMN IF EXISTS %I CASCADE', col_name);
    END LOOP;
END $$;

-- Step 1.4: Add constraints
DO $$ 
BEGIN
    -- Add unique constraint on slug if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'products' 
        AND constraint_name = 'products_slug_key'
    ) THEN
        -- Ensure all slugs are unique first
        UPDATE products p1
        SET slug = p1.slug || '-' || SUBSTRING(p1.id::text, 1, 8)
        WHERE EXISTS (
            SELECT 1 FROM products p2 
            WHERE p2.slug = p1.slug 
            AND p2.id != p1.id
        );
        
        ALTER TABLE products ADD CONSTRAINT products_slug_key UNIQUE (slug);
    END IF;

    -- Add foreign key to categories if categories table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'categories'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'products' 
            AND constraint_name = 'products_category_id_fkey'
        ) THEN
            ALTER TABLE products 
            ADD CONSTRAINT products_category_id_fkey 
            FOREIGN KEY (category_id) 
            REFERENCES categories(id) 
            ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Step 1.5: Create indexes
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NULL;

-- Step 1.6: Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Step 1.7: Summary
SELECT 
    'Products table cleaned up successfully!' AS status,
    COUNT(*) AS total_products
FROM products;

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;

