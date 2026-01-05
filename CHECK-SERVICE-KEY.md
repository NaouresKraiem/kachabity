# Check Service Role Key Setup

## The Problem
You're getting RLS error because the **service role key is not loaded** or **server wasn't restarted**.

## Step-by-Step Fix

### 1. Check Your `.env.local` File

Open `/landing/.env.local` and make sure you have BOTH keys:

```env
# Public keys (required)
NEXT_PUBLIC_SUPABASE_URL=https://fhimhbrhlzhxojtiumhm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service role key (ADD THIS - it's missing!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Get Your Service Role Key

1. Go to: https://fhimhbrhlzhxojtiumhm.supabase.co/project/_/settings/api
2. Scroll to **Project API keys**
3. Find **`service_role`** (NOT anon!)
4. Click **Reveal** and copy it
5. Paste it in `.env.local` as shown above

### 3. IMPORTANT: Restart Your Server

```bash
# Stop your dev server completely (Ctrl+C)
# Then restart:
npm run dev
```

The environment variables are ONLY loaded when the server starts!

### 4. Test

Now try creating a color in `/admin/variants`

## Still Not Working?

### Check if the key is loaded:

Add this temporarily to `/app/api/colors/route.ts` at the top:

```typescript
console.log('Service key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('Service key starts with:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20));
```

Then check your terminal output when you try to create a color.

**Should see:**
```
Service key exists: true
Service key starts with: eyJhbGciOiJIUzI1NiIsI
```

**If you see:**
```
Service key exists: false
Service key starts with: undefined
```

Then the key is NOT in your `.env.local` or server wasn't restarted!

## Common Mistakes

❌ **Forgot to add the key to .env.local**  
❌ **Didn't restart the server after adding it**  
❌ **Added it to .env instead of .env.local**  
❌ **Typo in the variable name (must be exactly `SUPABASE_SERVICE_ROLE_KEY`)**  
❌ **Extra spaces before/after the key value**  

## Correct Format

```env
# ✅ CORRECT
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ❌ WRONG (space before =)
SUPABASE_SERVICE_ROLE_KEY =eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ❌ WRONG (space after =)
SUPABASE_SERVICE_ROLE_KEY= eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ❌ WRONG (quotes around value)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## After Adding the Key

1. ✅ Add `SUPABASE_SERVICE_ROLE_KEY=your-key` to `.env.local`
2. ✅ Stop server (Ctrl+C)
3. ✅ Start server (`npm run dev`)
4. ✅ Try creating a color
5. ✅ Should work!

---

**The RLS error happens because the API is using the anon key (which respects RLS) instead of the service role key (which bypasses RLS). The service role key MUST be in your environment variables!**



