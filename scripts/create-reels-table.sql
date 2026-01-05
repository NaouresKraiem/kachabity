-- Create Reels Table for TikTok-style Vertical Videos
-- Run this in Supabase SQL Editor

-- Drop table if exists (be careful in production!)
DROP TABLE IF EXISTS reels CASCADE;

-- Create reels table
CREATE TABLE reels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    username TEXT DEFAULT '@kachabiti',
    thumbnail_url TEXT NOT NULL,
    video_url TEXT NOT NULL, -- YouTube, Instagram, TikTok, Facebook link
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    is_new BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_reels_active ON reels(active);
CREATE INDEX idx_reels_sort ON reels(sort_order);
CREATE INDEX idx_reels_is_new ON reels(is_new);

-- Disable RLS and make it public (like other tables)
ALTER TABLE reels DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can view reels" ON reels;
DROP POLICY IF EXISTS "Public can insert reels" ON reels;
DROP POLICY IF EXISTS "Public can update reels" ON reels;
DROP POLICY IF EXISTS "Public can delete reels" ON reels;

-- Enable RLS
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;

-- Create public policies
CREATE POLICY "Public can view reels"
ON reels FOR SELECT
TO public
USING (true);

CREATE POLICY "Public can insert reels"
ON reels FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Public can update reels"
ON reels FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Public can delete reels"
ON reels FOR DELETE
TO public
USING (true);

-- Insert sample data (optional)
INSERT INTO reels (title, description, username, thumbnail_url, video_url, sort_order, active, is_new) VALUES
('منتجاتنا الجديدة', 'تعرف على أحدث المنتجات 🔥', '@kachabiti', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1080&h=1920&fit=crop', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 1, true, true),
('عروض حصرية', 'خصومات مميزة لفترة محدودة', '@kachabiti', 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1080&h=1920&fit=crop', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 2, true, false),
('آراء العملاء', 'شاهد تجارب عملائنا', '@kachabiti', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1080&h=1920&fit=crop', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 3, true, false);

-- Verify
SELECT * FROM reels ORDER BY sort_order;

