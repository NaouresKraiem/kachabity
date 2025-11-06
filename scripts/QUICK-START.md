# 🚀 Quick Start Guide - 5 Minutes Setup

Follow these steps to get your database-backed cart system running:

---

## Step 1: Run the SQL Migration (2 minutes)

1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Open the file: `scripts/create-carts-table.sql`
6. Copy **ALL** the contents
7. Paste into the SQL Editor
8. Click **RUN** button
9. Wait for "Success" message

✅ **Verify:** Run this query to confirm:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('carts', 'cart_items');
```
You should see 2 rows returned.

---

## Step 2: Update Environment Variables (30 seconds)

Check your `.env.local` file has these variables:

```env
# Supabase (should already exist)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# For email recovery (optional, already in your project)
RESEND_API_KEY=your-resend-key
EMAIL_FROM=noreply@yourdomain.com

# Your site URL (for email links)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## Step 3: Restart Development Server (30 seconds)

```bash
# Stop current server (Ctrl+C)
# Then restart:
npm run dev
```

---

## Step 4: Test It! (2 minutes)

### Test 1: Basic Cart
1. Open your site: http://localhost:3000
2. Add a product to cart
3. Refresh page → cart should still have items ✅
4. Close browser and reopen → cart should still have items ✅

### Test 2: Database Verification
Go to Supabase Dashboard → Table Editor → `carts` table
- You should see 1 row with your session_id ✅

Go to `cart_items` table
- You should see your product ✅

### Test 3: Analytics Dashboard
1. Visit: http://localhost:3000/admin/cart-analytics
2. You should see:
   - Summary cards with statistics
   - Daily analytics table
   - Abandoned carts section

---

## Step 5: Optional - Setup Cron Job for Cleanup

In Supabase Dashboard:

1. Go to **Database** → **Extensions**
2. Enable **pg_cron**
3. Go to **SQL Editor**
4. Run this:

```sql
-- Run cleanup every day at 2 AM
SELECT cron.schedule(
    'cleanup-old-carts',
    '0 2 * * *',
    $$SELECT cleanup_old_carts()$$
);
```

---

## ✅ You're Done!

Your cart system is now:
- ✅ Storing in database (not localStorage)
- ✅ Working for guest users
- ✅ Ready for authenticated users
- ✅ Tracking analytics
- ✅ Ready for email recovery

---

## 🧪 Advanced Testing

### Test Guest → User Cart Merge

1. **As Guest:**
   - Add 2 products to cart
   - Note: You're not logged in

2. **Login:**
   - Create account or login
   - Cart should still show 2 products ✅

3. **Verify in Database:**
   - Check `carts` table
   - Old cart: `status = 'merged'`
   - New cart: `status = 'active'` with `user_id` set

### Test Cross-Device Sync

1. **Device A (or Browser A):**
   - Login with account
   - Add 3 products to cart

2. **Device B (or Browser B - Incognito):**
   - Login with same account
   - Should see same 3 products ✅

---

## 📧 Test Email Recovery

### Setup (if not done):
1. Make sure `RESEND_API_KEY` is in `.env.local`
2. Verify Resend account is active

### Test:
```bash
# 1. Add items to cart as logged-in user
# 2. Wait 1 hour (or manually set last_activity_at in database)
# 3. Call the API:

curl -X POST http://localhost:3000/api/cart/send-recovery-emails
```

Check your email for the abandoned cart recovery message!

---

## 🎯 What's Different Now?

### Before (localStorage):
```typescript
// Lost on browser clear
// No cross-device sync
// No analytics
```

### After (Database):
```typescript
// Persistent forever
// Syncs across devices
// Full analytics
// Email recovery
// Guest user support
```

---

## 🐛 Common Issues

### Issue: "Failed to get cart"
**Fix:** Check Supabase credentials in `.env.local`

### Issue: "RLS policy error"
**Fix:** Make sure you ran the ENTIRE SQL script, including RLS policies at the end

### Issue: Cart not syncing across devices
**Fix:** Make sure user is logged in (check auth state)

### Issue: Analytics page blank
**Fix:** Add some items to cart first, then check analytics

---

## 📖 Next Steps

1. ✅ Review `scripts/IMPLEMENTATION-SUMMARY.md` for full details
2. ✅ Read `scripts/CART-SETUP-GUIDE.md` for advanced features
3. ✅ Customize email templates in `lib/abandoned-cart-email.ts`
4. ✅ Add admin authentication to analytics page
5. ✅ Setup abandoned cart email cron job

---

## 🎉 Success!

You now have a professional e-commerce cart system!

**Total Setup Time: ~5 minutes** ⚡

Questions? Check the documentation files in the `scripts/` folder.

Happy selling! 🛒💰

