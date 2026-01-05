-- Remove link_url column from promotions table
-- Run this in Supabase SQL Editor
-- This field is not needed for sale banners (only used in reels)

-- Check if column exists before removing
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'promotions' 
        AND column_name = 'link_url'
    ) THEN
        -- Drop the link_url column
        ALTER TABLE promotions DROP COLUMN link_url;
        RAISE NOTICE 'Column link_url has been removed from promotions table';
    ELSE
        RAISE NOTICE 'Column link_url does not exist in promotions table';
    END IF;
END $$;

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'promotions' 
ORDER BY ordinal_position;



