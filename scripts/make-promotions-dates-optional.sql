-- Make starts_at and ends_at columns optional in promotions table
-- This allows creating promotions/sale banners without date restrictions

-- Update the columns to allow NULL values
ALTER TABLE promotions 
ALTER COLUMN starts_at DROP NOT NULL;

ALTER TABLE promotions 
ALTER COLUMN ends_at DROP NOT NULL;

-- Verify the changes
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'promotions' 
AND column_name IN ('starts_at', 'ends_at');



