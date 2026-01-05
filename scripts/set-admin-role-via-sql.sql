-- Set Admin Role via SQL (Works even if user is not verified)
-- Run this in Supabase SQL Editor

-- Replace 'your-email@example.com' with your actual email address
UPDATE auth.users
SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'your-email@example.com';

-- Verify it worked
SELECT 
    email,
    raw_user_meta_data->>'role' as role,
    email_confirmed_at,
    created_at
FROM auth.users
WHERE email = 'your-email@example.com';

-- If you want to set admin for multiple users, run this for each:
-- UPDATE auth.users
-- SET raw_user_meta_data = 
--     COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- WHERE email = 'another-admin@example.com';



