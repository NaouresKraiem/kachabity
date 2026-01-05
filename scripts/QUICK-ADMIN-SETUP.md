# Quick Admin Setup Guide

If you're getting 401 errors when accessing admin routes, follow these steps:

## Step 1: Check Your Current User

1. Go to your website and make sure you're **logged in**
2. Check browser console for authentication logs

## Step 2: Set Admin Role (Choose ONE method)

### Method A: User Metadata (Easiest - Recommended)

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Find your user email
3. Click on the user
4. Scroll to **User Metadata** section
5. Click **Edit** or **+** button
6. Add this JSON:
   ```json
   {
     "role": "admin"
   }
   ```
7. Click **Save**
8. **Log out and log back in** on your website

### Method B: Environment Variable (Quick)

1. Open `.env.local` file
2. Add your email:
   ```env
   ADMIN_EMAILS=your-email@example.com
   ```
3. **Restart your dev server**:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```
4. **Log out and log back in**

### Method C: Database (If you have users table)

1. Run this SQL in Supabase SQL Editor:
   ```sql
   UPDATE users 
   SET role = 'admin' 
   WHERE email = 'your-email@example.com';
   ```
2. **Log out and log back in**

## Step 3: Verify Admin Access

1. Check browser console - you should see logs like:
   ```
   Checking admin status for user: your-email@example.com
   User is admin (via metadata)
   ```

2. Try accessing `/api/admin/products` - should return 200 OK

## Troubleshooting

### Still getting 401?

1. **Check browser console** for authentication logs
2. **Check server logs** for admin check logs
3. **Verify you're logged in** - check if `supabase.auth.getUser()` returns a user
4. **Try logging out and back in** after setting admin role

### Common Issues

- **"No user found"**: You're not logged in. Log in first.
- **"User is NOT admin"**: Admin role not set. Use one of the methods above.
- **"Error getting user"**: Authentication cookies issue. Try logging out/in.

## Debug Logs

The improved `isAdmin()` function now logs:
- User email and ID
- Which method detected admin status
- Why admin check failed

Check your **server console** (where `npm run dev` is running) for these logs.




