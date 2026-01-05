# How to Create an Admin Account

There are **3 ways** to create an admin account. Choose the method that works best for you:

---

## 🎯 **Method 1: Using Supabase Dashboard (Recommended - Easiest)**

This is the easiest method and works immediately.

### Step 1: Create a User Account
1. Go to your website: `http://localhost:3000/en/auth`
2. Sign up with your email and password
3. Verify your email (if email verification is enabled)

### Step 2: Set Admin Role in Supabase
1. Go to **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **Users** in the left sidebar
4. Find your user email in the list
5. Click on the user to open details
6. Scroll down to **User Metadata** section
7. Click **Edit** or the **+** button
8. Add this JSON:
   ```json
   {
     "role": "admin"
   }
   ```
9. Click **Save**

### Step 3: Test Admin Access
1. Log out from your website (if logged in)
2. Log in again with your admin account
3. Visit: `http://localhost:3000/admin`
4. You should now have access! ✅

---

## 🚀 **Method 2: Using Environment Variable (Quick Setup)**

This method is good for initial setup or development.

### Step 1: Create a User Account
1. Go to your website: `http://localhost:3000/en/auth`
2. Sign up with your email and password

### Step 2: Add Email to Environment Variable
1. Open your `.env.local` file in the project root
2. Add this line (replace with your actual email):
   ```env
   ADMIN_EMAILS=your-email@example.com,another-admin@example.com
   ```
   You can add multiple emails separated by commas.

3. Save the file
4. **Restart your development server**:
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

### Step 3: Test Admin Access
1. Log out and log in again
2. Visit: `http://localhost:3000/admin`
3. You should now have access! ✅

**Note:** This method checks the email address, so make sure you use the exact email you signed up with.

---

## 🔒 **Method 3: Using Database Table (Most Secure - For Production)**

This method requires a users table with a role column. Currently commented out in the code.

### Step 1: Create Users Table with Roles
Run this SQL in Supabase SQL Editor:

```sql
-- Create users table with role column
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add role column if table exists
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Insert admin user (replace with your email)
INSERT INTO public.users (email, name, role)
VALUES ('your-email@example.com', 'Admin User', 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin';
```

### Step 2: Enable the Database Check
1. Open `lib/admin-auth.ts`
2. Uncomment the "Option 3" section (lines 50-62)
3. Save the file

### Step 3: Test Admin Access
1. Log out and log in again
2. Visit: `http://localhost:3000/admin`
3. You should now have access! ✅

---

## 🎨 **Which Method Should I Use?**

| Method | Best For | Pros | Cons |
|--------|---------|------|------|
| **Method 1** (User Metadata) | Quick setup, Development | ✅ Easiest<br>✅ No code changes<br>✅ Works immediately | ⚠️ Manual setup per user |
| **Method 2** (Environment Variable) | Development, Testing | ✅ Quick<br>✅ Multiple admins easy<br>✅ No database changes | ⚠️ Requires server restart<br>⚠️ Less secure (email-based) |
| **Method 3** (Database Table) | Production, Multiple admins | ✅ Most secure<br>✅ Scalable<br>✅ Easy to manage | ⚠️ Requires SQL setup<br>⚠️ Need to uncomment code |

**Recommendation:**
- **For Development**: Use **Method 1** (User Metadata) - it's the easiest
- **For Production**: Use **Method 3** (Database Table) - it's the most secure

---

## 🔍 **Troubleshooting**

### "Unauthorized" Error
- Make sure you're logged in
- Check that the role is set correctly:
  - Method 1: Check User Metadata in Supabase
  - Method 2: Check `.env.local` has your email
  - Method 3: Check database has your user with `role = 'admin'`

### "Checking access..." Forever
- Check browser console for errors
- Verify Supabase connection is working
- Make sure you're logged in

### Can't Access Admin After Setting Role
1. **Log out completely** from your website
2. **Clear browser cookies** (optional but recommended)
3. **Log in again**
4. Try accessing `/admin` again

### Multiple Admin Accounts
- **Method 1**: Set `"role": "admin"` for each user in Supabase
- **Method 2**: Add all emails to `ADMIN_EMAILS` separated by commas
- **Method 3**: Insert multiple users with `role = 'admin'` in database

---

## 📝 **Quick Reference**

### Check Current Admin Status
Run this in Supabase SQL Editor to see all admin users:

```sql
-- For Method 1 (User Metadata)
-- Check in Supabase Dashboard → Authentication → Users → User Metadata

-- For Method 2 (Environment Variable)
-- Check your .env.local file

-- For Method 3 (Database)
SELECT email, name, role FROM public.users WHERE role = 'admin';
```

### Remove Admin Access
- **Method 1**: Remove `"role": "admin"` from User Metadata in Supabase
- **Method 2**: Remove email from `ADMIN_EMAILS` in `.env.local` and restart server
- **Method 3**: Update user in database: `UPDATE users SET role = 'user' WHERE email = '...'`

---

## ✅ **Success Checklist**

After setting up admin access, verify:

- [ ] User account created and logged in
- [ ] Admin role set (using one of the 3 methods)
- [ ] Can access `http://localhost:3000/admin`
- [ ] Can see admin dashboard/products page
- [ ] Can create/edit products
- [ ] No "Unauthorized" errors

---

**Need Help?** Check the browser console for errors or verify your Supabase connection is working properly.



