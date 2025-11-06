-- Create small_cards table
CREATE TABLE IF NOT EXISTS public.small_cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    image_url TEXT NOT NULL,
    bg_color TEXT NOT NULL DEFAULT 'bg-gray-100',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.small_cards ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public read" ON public.small_cards FOR SELECT USING (true);
CREATE POLICY "Allow inserts" ON public.small_cards FOR INSERT WITH CHECK (true);

-- Insert sample data
INSERT INTO public.small_cards (title, subtitle, image_url, bg_color, is_active, sort_order) VALUES
('Flint & Kent', 'Amazing Quality', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300', 'bg-pink-50', true, 1),
('Milisten Handwoven', 'Sale 50%', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300', 'bg-pink-100', true, 2),
('Coussin et Galette', 'Sale off 50%', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300', 'bg-gray-100', true, 3),
('Clean hands', 'Clean bacteria', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300', 'bg-gray-100', true, 4),
('Nice bag', 'Nice style', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300', 'bg-green-100', true, 5);
