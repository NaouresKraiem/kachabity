-- Confirm Admin Email (Fix "Email not confirmed" error)
-- Run this in Supabase SQL Editor
-- 
-- This script confirms the email for admin users so they can sign in
-- without needing to verify their email address

-- Replace 'your-email@example.com' with your actual admin email address
-- Note: confirmed_at is a generated column and cannot be updated manually
UPDATE auth.users
SET 
    email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email = 'your-email@example.com';

-- Also set admin role if not already set
UPDATE auth.users
SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'your-email@example.com';

-- Verify it worked - check email confirmation status
SELECT 
    email,
    email_confirmed_at,
    confirmed_at,  -- This is auto-generated from email_confirmed_at
    raw_user_meta_data->>'role' as role,
    created_at
FROM auth.users
WHERE email = 'your-email@example.com';

-- If email_confirmed_at is NOT NULL, the email is confirmed ✅
-- confirmed_at will automatically be set when email_confirmed_at is set
-- If role is 'admin', the user has admin privileges ✅

