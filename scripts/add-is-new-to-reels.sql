-- Add is_new field to reels table
-- Run this in Supabase SQL Editor

-- Add the is_new column to the reels table
ALTER TABLE reels 
ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT false;

-- Create index for faster queries on is_new
CREATE INDEX IF NOT EXISTS idx_reels_is_new ON reels(is_new);

-- Update the first reel to be marked as "new" (example)
-- You can manually set which videos should show the NEW badge
-- UPDATE reels SET is_new = true WHERE id = 'your-reel-id';

-- Verify the change
SELECT id, title, is_new, created_at FROM reels ORDER BY sort_order;



