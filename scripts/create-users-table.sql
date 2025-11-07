-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Public read access" ON public.users FOR SELECT USING (true);

-- Insert sample users
INSERT INTO public.users (name, email, avatar_url) VALUES
('Naoures', 'naoures.kraiem@esen.tn', NULL),
('wassim', 'wassim@gmail.com', NULL),
('samia', 'samia.nguyen@gmail.com', NULL)
('mounir', 'mounir@gmail.com', NULL)

ON CONFLICT (email) DO NOTHING;

-- Update reviews table to use user_id instead of user_name
-- First, add user_id column if it doesn't exist
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);

-- Migrate existing data: match user_name to users table and populate user_id
UPDATE public.reviews r
SET user_id = u.id
FROM public.users u
WHERE r.user_name = u.name AND r.user_id IS NULL;

-- For any reviews without a matching user, create a default user
DO $$
DECLARE
    default_user_id UUID;
BEGIN
    -- Create or get 'Anonymous' user
    INSERT INTO public.users (name, email)
    VALUES ('Anonymous', 'anonymous@example.com')
    ON CONFLICT (email) DO UPDATE SET name = 'Anonymous'
    RETURNING id INTO default_user_id;
    
    -- Set remaining NULL user_id values to Anonymous
    UPDATE public.reviews
    SET user_id = default_user_id
    WHERE user_id IS NULL;
END $$;

-- Now we can make user_id NOT NULL since all reviews have a user
ALTER TABLE public.reviews ALTER COLUMN user_id SET NOT NULL;

-- Optional: Drop user_name column if you want (uncomment if needed)
-- ALTER TABLE public.reviews DROP COLUMN IF EXISTS user_name;

-- Add foreign key constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'reviews_user_id_fkey'
    ) THEN
        ALTER TABLE public.reviews 
        ADD CONSTRAINT reviews_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index on user_id for better join performance
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);

-- Verify the migration
SELECT 
    r.id,
    r.rating,
    r.comment,
    r.user_name as old_user_name,
    u.name as new_user_name,
    u.email
FROM public.reviews r
LEFT JOIN public.users u ON r.user_id = u.id
LIMIT 10;

