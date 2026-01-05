# Fix Colors and Sizes RLS Policy Error

## Problem
You're getting: **"new row violates row-level security policy for table 'colors'"**

This happens because:
1. The colors/sizes tables have RLS (Row Level Security) enabled
2. The RLS policies are either missing or not properly configured for admin users
3. Your admin user might not have the correct role set

## Solution

### Step 1: Run the SQL Script

Go to your **Supabase Dashboard → SQL Editor** and run:

```bash
/scripts/create-colors-sizes-tables.sql
```

This script will:
- ✅ Create colors and sizes tables (if they don't exist)
- ✅ Set up proper RLS policies
- ✅ Allow admins to INSERT, UPDATE, DELETE
- ✅ Allow public users to READ (SELECT) only

### Step 2: Verify Your Admin Role

Make sure your user has the admin role set. Run this in Supabase SQL Editor:

```sql
-- Check your current role
SELECT 
    email,
    raw_user_meta_data->>'role' as role
FROM auth.users 
WHERE email = 'your-email@example.com';
```

If the role is `NULL` or not `admin`, set it:

```sql
-- Set admin role
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'
WHERE email = 'your-email@example.com';
```

**Replace `your-email@example.com` with your actual admin email!**

### Step 3: Log Out and Log Back In

After setting the role:
1. Log out from your admin panel
2. Log back in
3. Try creating a color or size again

## What the RLS Policies Do

### For Colors Table:
- **Public (anyone):** Can VIEW colors
- **Admin users:** Can CREATE, UPDATE, DELETE colors
- **Soft deletes:** Deleted colors have `deleted_at` timestamp set

### For Sizes Table:
- **Public (anyone):** Can VIEW sizes  
- **Admin users:** Can CREATE, UPDATE, DELETE sizes
- **Soft deletes:** Deleted sizes have `deleted_at` timestamp set

## RLS Policy Logic

The policies check if:
```sql
auth.uid() IS NOT NULL  -- User is logged in
AND (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' 
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
)
```

## Testing

After running the script and setting your role:

1. Go to `/admin/variants`
2. Click "Add Color"
3. Enter name: "Test Red"
4. Pick a color
5. Click "Create"

If it works → ✅ Problem solved!

If it still fails → Check the error in browser console (F12) and verify your role is set correctly.

## Alternative: Temporarily Disable RLS (NOT RECOMMENDED)

If you're still having issues and need to test quickly:

```sql
-- ⚠️ NOT RECOMMENDED FOR PRODUCTION
ALTER TABLE colors DISABLE ROW LEVEL SECURITY;
ALTER TABLE sizes DISABLE ROW LEVEL SECURITY;
```

But **re-enable it** after testing:
```sql
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sizes ENABLE ROW LEVEL SECURITY;
```

## Common Issues

### Issue: Still getting RLS error after setting role
**Solution:** Clear your browser cache and cookies, then log out and log back in

### Issue: Role is set but policies still fail
**Solution:** Check if the policy names match. Run:
```sql
SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('colors', 'sizes');
```

### Issue: User is not authenticated
**Solution:** Make sure you're logged in. Check:
```sql
SELECT auth.uid();  -- Should return your user ID, not NULL
```

---

**Status:** Ready to run  
**Required:** Admin role must be set in user_metadata



