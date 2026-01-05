-- =====================================================
-- MIGRATION: Populate product_variants from products (TEXT[] version)
-- =====================================================
-- Alternative version for products table using TEXT[] arrays instead of JSONB
-- Use this if your products table has colors and sizes as TEXT[] columns
-- =====================================================

-- Step 1: Create variants from products with colors and sizes (TEXT[] arrays)
INSERT INTO product_variants (
    product_id,
    color,
    size,
    stock,
    price_cents,
    image_url,
    images,
    is_active,
    created_at,
    updated_at
)
SELECT 
    p.id AS product_id,
    color_value AS color,
    size_value AS size,
    -- Distribute stock evenly
    CASE 
        WHEN array_length(p.colors, 1) > 0 AND array_length(p.sizes, 1) > 0
        THEN GREATEST(1, (p.stock / (array_length(p.colors, 1) * array_length(p.sizes, 1)))::integer)
        WHEN array_length(p.colors, 1) > 0
        THEN GREATEST(1, (p.stock / array_length(p.colors, 1))::integer)
        WHEN array_length(p.sizes, 1) > 0
        THEN GREATEST(1, (p.stock / array_length(p.sizes, 1))::integer)
        ELSE p.stock
    END AS stock,
    CASE 
        WHEN p.price_cents IS NULL OR p.price_cents::text = '' THEN NULL
        ELSE (p.price_cents::text::integer)
    END AS price_cents,
    p.image_url AS image_url,
    COALESCE(p.images, '[]'::jsonb) AS images,
    true AS is_active,
    NOW() AS created_at,
    NOW() AS updated_at
FROM products p
CROSS JOIN LATERAL unnest(COALESCE(p.colors, ARRAY[]::TEXT[])) AS color_value
CROSS JOIN LATERAL unnest(COALESCE(p.sizes, ARRAY[]::TEXT[])) AS size_value
WHERE 
    NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id)
    AND p.colors IS NOT NULL 
    AND array_length(p.colors, 1) > 0
    AND p.sizes IS NOT NULL 
    AND array_length(p.sizes, 1) > 0
ON CONFLICT (product_id, COALESCE(color, ''), COALESCE(size, '')) 
DO NOTHING;

-- Step 2: Create variants from products with ONLY colors (TEXT[] array)
INSERT INTO product_variants (
    product_id,
    color,
    size,
    stock,
    price_cents,
    image_url,
    images,
    is_active,
    created_at,
    updated_at
)
SELECT 
    p.id AS product_id,
    color_value AS color,
    '' AS size,  -- Use empty string instead of NULL to avoid NOT NULL constraint
    GREATEST(1, (p.stock / array_length(p.colors, 1))::integer) AS stock,
    CASE 
        WHEN p.price_cents IS NULL OR p.price_cents::text = '' THEN NULL
        ELSE (p.price_cents::text::integer)
    END AS price_cents,
    p.image_url AS image_url,
    COALESCE(p.images, '[]'::jsonb) AS images,
    true AS is_active,
    NOW() AS created_at,
    NOW() AS updated_at
FROM products p
CROSS JOIN LATERAL unnest(COALESCE(p.colors, ARRAY[]::TEXT[])) AS color_value
WHERE 
    NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id)
    AND p.colors IS NOT NULL 
    AND array_length(p.colors, 1) > 0
    AND (p.sizes IS NULL OR array_length(p.sizes, 1) IS NULL OR array_length(p.sizes, 1) = 0)
ON CONFLICT (product_id, COALESCE(color, ''), COALESCE(size, '')) 
DO NOTHING;

-- Step 3: Create variants from products with ONLY sizes (TEXT[] array)
INSERT INTO product_variants (
    product_id,
    color,
    size,
    stock,
    price_cents,
    image_url,
    images,
    is_active,
    created_at,
    updated_at
)
SELECT 
    p.id AS product_id,
    '' AS color,  -- Use empty string instead of NULL to avoid NOT NULL constraint
    size_value AS size,
    GREATEST(1, (p.stock / array_length(p.sizes, 1))::integer) AS stock,
    CASE 
        WHEN p.price_cents IS NULL OR p.price_cents::text = '' THEN NULL
        ELSE (p.price_cents::text::integer)
    END AS price_cents,
    p.image_url AS image_url,
    COALESCE(p.images, '[]'::jsonb) AS images,
    true AS is_active,
    NOW() AS created_at,
    NOW() AS updated_at
FROM products p
CROSS JOIN LATERAL unnest(COALESCE(p.sizes, ARRAY[]::TEXT[])) AS size_value
WHERE 
    NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id)
    AND p.sizes IS NOT NULL 
    AND array_length(p.sizes, 1) > 0
    AND (p.colors IS NULL OR array_length(p.colors, 1) IS NULL OR array_length(p.colors, 1) = 0)
ON CONFLICT (product_id, COALESCE(color, ''), COALESCE(size, '')) 
DO NOTHING;

-- Step 4: Create default variant for products with no colors/sizes
INSERT INTO product_variants (
    product_id,
    color,
    size,
    stock,
    price_cents,
    image_url,
    images,
    is_active,
    created_at,
    updated_at
)
SELECT 
    p.id AS product_id,
    '' AS color,  -- Use empty string instead of NULL to avoid NOT NULL constraint
    '' AS size,   -- Use empty string instead of NULL to avoid NOT NULL constraint
    p.stock AS stock,
    CASE 
        WHEN p.price_cents IS NULL OR p.price_cents::text = '' THEN NULL
        ELSE (p.price_cents::text::integer)
    END AS price_cents,
    p.image_url AS image_url,
    COALESCE(p.images, '[]'::jsonb) AS images,
    true AS is_active,
    NOW() AS created_at,
    NOW() AS updated_at
FROM products p
WHERE 
    NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id)
    AND (
        p.colors IS NULL 
        OR array_length(p.colors, 1) IS NULL 
        OR array_length(p.colors, 1) = 0
    )
    AND (
        p.sizes IS NULL 
        OR array_length(p.sizes, 1) IS NULL 
        OR array_length(p.sizes, 1) = 0
    )
ON CONFLICT (product_id, COALESCE(color, ''), COALESCE(size, '')) 
DO NOTHING;

-- Step 5: Generate SKUs
UPDATE product_variants pv
SET sku = CONCAT(
    LOWER(REPLACE(REPLACE(p.slug, ' ', '-'), '_', '-')),
    CASE WHEN pv.color IS NOT NULL THEN '-' || LOWER(REPLACE(pv.color, '#', '')) ELSE '' END,
    CASE WHEN pv.size IS NOT NULL THEN '-' || LOWER(pv.size) ELSE '' END
)
FROM products p
WHERE pv.product_id = p.id
AND pv.sku IS NULL;

-- Step 6: Summary report
DO $$
DECLARE
    total_products INTEGER;
    products_with_variants INTEGER;
    total_variants INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_products FROM products;
    SELECT COUNT(DISTINCT product_id) INTO products_with_variants FROM product_variants;
    SELECT COUNT(*) INTO total_variants FROM product_variants;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATION SUMMARY (TEXT[] Arrays)';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total products: %', total_products;
    RAISE NOTICE 'Products with variants: %', products_with_variants;
    RAISE NOTICE 'Total variants created: %', total_variants;
    RAISE NOTICE '========================================';
END $$;

SELECT 'Migration completed! Check the NOTICE messages above for summary.' AS status;

