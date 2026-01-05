# Add Supabase Service Role Key

## Problem Fixed
The RLS error happens because the API was using the **anon key** which respects RLS policies. I've updated the code to use the **service role key** which bypasses RLS for admin operations.

## What You Need to Do

### Step 1: Get Your Service Role Key

1. Go to your **Supabase Dashboard**
2. Navigate to: **Settings → API**
3. Find the section **Project API keys**
4. Copy the **`service_role`** key (NOT the anon key)

⚠️ **Important:** The service role key is secret and should NEVER be exposed to the client!

### Step 2: Add to Environment Variables

Add this to your `.env.local` file:

```env
# Your existing keys
NEXT_PUBLIC_SUPABASE_URL=https://fhimhbrhlzhxojtiumhm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Add this new line (service role key)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Step 3: Restart Your Dev Server

```bash
# Stop your server (Ctrl+C)
# Then restart it
npm run dev
```

### Step 4: Test

1. Go to `/admin/variants`
2. Click "Add Color"
3. Enter name: "Sky Blue"
4. Pick a color
5. Click "Create"

Should work now! ✅

## What Changed in the Code

### Before (using anon key):
```typescript
import supabase from '@/lib/supabaseClient';

// This respects RLS policies
await supabase.from('colors').insert([colorData]);
```

### After (using service role):
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// This BYPASSES RLS policies (admin access)
await supabaseAdmin.from('colors').insert([colorData]);
```

## Files Updated
- ✅ `/app/api/colors/route.ts` - Now uses service role
- ✅ `/app/api/sizes/route.ts` - Now uses service role

## Security Notes

✅ **Safe:** Service role key is only used in API routes (server-side)  
✅ **Safe:** Never exposed to the browser  
✅ **Safe:** Environment variable is server-only  
⚠️ **Never:** Add service role key to `NEXT_PUBLIC_*` variables  
⚠️ **Never:** Use service role key in client components  

## Alternative: Run SQL Script (Optional)

If you prefer to keep using the anon key with proper RLS policies, run this instead:

```sql
-- In Supabase SQL Editor
-- This allows ANY authenticated user to manage colors/sizes
-- See: /scripts/fix-colors-sizes-rls-simple.sql
```

But using the service role key is simpler and more secure for admin-only operations.

---

**Status:** Ready to use  
**Required:** Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`



