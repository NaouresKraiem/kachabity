# How to Verify Admin Email in Supabase Dashboard (Graphical Interface)

This guide shows you how to confirm/verify an admin email address using the Supabase Dashboard without writing any SQL.

---

## 🎯 Step-by-Step Instructions

### Step 1: Open Supabase Dashboard

1. Go to **https://supabase.com/dashboard**
2. Sign in with your Supabase account
3. Select your project from the list

---

### Step 2: Navigate to Authentication

1. In the left sidebar, click on **"Authentication"** (it has a key icon 🔑)
2. You'll see several sub-menu items:
   - Users
   - Policies
   - Providers
   - URL Configuration
   - Email Templates
   - Settings

---

### Step 3: Open Users List

1. Click on **"Users"** in the Authentication sub-menu
2. You'll see a table/list of all registered users
3. The table shows columns like:
   - Email
   - User ID (UUID)
   - Created At
   - Last Sign In
   - (Note: "Email Confirmed" column might not be visible by default)

**⚠️ Important:** If you don't see an "Email Confirmed" column, that's normal! Many Supabase dashboards don't show this column by default. Use the SQL method below instead (it's the most reliable way).

---

### Step 4: Find Your Admin User

1. Look through the list or use the search bar at the top
2. Find the user with your admin email address
3. **Click on the user row** to open the details panel (we'll check confirmation status there)

---

### Step 5: Check Email Status (Using SQL - Most Reliable Method)

Since the "Email Confirmed" column might not be visible, let's use SQL to check and fix it:

1. Go to **SQL Editor** in the left sidebar (it's usually at the bottom of the sidebar)
2. Click **"New query"** button
3. First, let's **check the current status** - paste this SQL (replace with your email):
   ```sql
   -- Check if email is confirmed
   SELECT 
       email,
       email_confirmed_at,
       confirmed_at,
       raw_user_meta_data->>'role' as role
   FROM auth.users
   WHERE email = 'your-admin-email@example.com';
   ```
4. Click **"Run"** or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
5. Look at the results:
   - If `email_confirmed_at` is **NULL** = Email is NOT confirmed ❌
   - If `email_confirmed_at` has a **timestamp** = Email IS confirmed ✅

---

### Step 6: Confirm the Email (Using SQL)

Now let's confirm the email:

1. In the same SQL Editor, click **"New query"** again
2. Paste this SQL (replace with your email):
   ```sql
   -- Confirm the email
   -- Note: confirmed_at is auto-generated, we only need to set email_confirmed_at
   UPDATE auth.users
   SET 
       email_confirmed_at = NOW()
   WHERE email = 'your-admin-email@example.com';
   ```
3. Click **"Run"**
4. You should see: **"Success. No rows returned"** or **"1 row updated"** ✅

**That's it!** Your email is now confirmed. You can verify by running the SELECT query from Step 5 again.

---

### Step 7: Set Admin Role (Using SQL)

While you're in the SQL Editor, also set the admin role:

1. Click **"New query"** again
2. Paste this SQL (replace with your email):
   ```sql
   -- Set admin role
   UPDATE auth.users
   SET raw_user_meta_data = 
       COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
   WHERE email = 'your-admin-email@example.com';
   ```
3. Click **"Run"**
4. You should see: **"Success"** ✅

**Alternative: Set role via Dashboard UI**
1. Go back to **Authentication** → **Users**
2. Click on your admin user
3. Scroll to **"User Metadata"** section
4. Click **"Edit"** or **"+"** button
5. Add: `{"role": "admin"}`
6. Click **"Save"**

---

### Step 8: Verify Everything Worked

Run this final verification query in SQL Editor:

```sql
-- Final verification
SELECT 
    email,
    email_confirmed_at,
    confirmed_at,
    raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'your-admin-email@example.com';
```

**Expected Results:**
- ✅ `email_confirmed_at` = **A timestamp** (not NULL)
- ✅ `confirmed_at` = **A timestamp** (auto-generated, not NULL)
- ✅ `role` = **"admin"**

If all three show the expected values, you're all set! 🎉

---

## 🎯 Quick SQL Method (Recommended - Works Every Time)

**This is the easiest and most reliable method!**

1. Go to **Supabase Dashboard** → **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy and paste this (replace with your email):
   ```sql
   -- Confirm email and set admin role in one go
   -- Note: confirmed_at is auto-generated from email_confirmed_at
   UPDATE auth.users
   SET 
       email_confirmed_at = NOW(),
       raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
   WHERE email = 'your-admin-email@example.com';
   
   -- Verify it worked
   SELECT 
       email,
       email_confirmed_at,
       confirmed_at,  -- This will be auto-generated
       raw_user_meta_data->>'role' as role
   FROM auth.users
   WHERE email = 'your-admin-email@example.com';
   ```
4. Click **"Run"** or press `Ctrl+Enter` / `Cmd+Enter`
5. Check the results - you should see:
   - `email_confirmed_at` = timestamp ✅
   - `confirmed_at` = timestamp (auto-generated) ✅
   - `role` = "admin" ✅

**Done!** Now try logging in to your website.

---

## 📸 What to Look For

### Before Confirmation:
- **Email Confirmed column:** ❌ Empty or "Not confirmed"
- **User Details:** Shows "Email Confirmed: Not confirmed"
- **Sign In:** Shows "Email not confirmed" error

### After Confirmation:
- **Email Confirmed column:** ✅ Green checkmark or timestamp
- **User Details:** Shows "Email Confirmed: [date and time]"
- **Sign In:** Works successfully! ✅

---

## 🎯 Quick Visual Guide

```
Supabase Dashboard
├── Authentication (🔑)
    ├── Users ← Click here
        ├── [User List Table]
            ├── Email column
            ├── Email Confirmed column ← Check this!
            └── [Click on user row]
                └── User Details Panel
                    ├── Email Confirmed field
                    ├── Edit button
                    └── User Metadata section
```

---

## ✅ Checklist

After following these steps, verify:

- [ ] Found your admin user in the Users list
- [ ] Opened User Details panel
- [ ] Email Confirmed shows a timestamp (not "Not confirmed")
- [ ] User Metadata has `"role": "admin"` (optional but recommended)
- [ ] Can sign in to your website without "Email not confirmed" error
- [ ] Can access `/admin` pages successfully

---

## 🚨 Troubleshooting

### Don't See "Email Confirmed" Column?

- **This is normal!** Many Supabase dashboards don't show this column by default
- **Solution:** Use the SQL Editor method (Step 5-6 above) - it's the most reliable way
- SQL method works 100% of the time and shows you the exact status

### User Not Showing in List?

- Make sure you're looking in the correct project
- Check if you signed up with a different email
- Try searching by email address in the search bar

### Still Getting "Email not confirmed" Error?

1. **Clear browser cache and cookies**
2. **Log out completely** from your website
3. **Log in again** with your admin credentials
4. Check browser console for any other errors

### Permission Denied?

- Make sure you're the project owner or have admin access
- Contact the project owner to confirm the email for you

---

## 📝 Summary

**The easiest way:**
1. Go to **Authentication** → **Users**
2. Click on your admin user
3. If there's a "Confirm Email" button, click it
4. If not, use SQL Editor with the UPDATE query
5. Set admin role in User Metadata
6. Test login!

**That's it!** Your admin email should now be confirmed and you can sign in without any errors. 🎉

