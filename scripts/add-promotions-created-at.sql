-- Add created_at column to promotions table
-- This column was missing and causing insertion errors

-- 1. Add the created_at column with default value
ALTER TABLE promotions 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Update any existing records to have a created_at value
UPDATE promotions 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- 3. Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'promotions' 
AND column_name = 'created_at';
