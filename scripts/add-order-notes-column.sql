-- Add order_notes column to orders table
-- This allows customers to add special instructions or comments with their orders

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_notes TEXT;

-- Add a comment to describe the column
COMMENT ON COLUMN orders.order_notes IS 'Optional customer notes or special instructions for the order';

