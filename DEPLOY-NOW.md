# 🚀 Quick Netlify Deployment

Follow these steps to deploy your project to Netlify right now!

## Step 1: Install Netlify Plugin (1 minute)

```bash
cd /Users/takiacademy/Downloads/landing/landing
npm install
```

This will install the `@netlify/plugin-nextjs` that was just added to your `package.json`.

## Step 2: Push to GitHub (2 minutes)

If you haven't already, push your project to GitHub:

```bash
# Initialize git (if not done)
git init
git add .
git commit -m "Ready for Netlify deployment"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy on Netlify (5 minutes)

### Option A: Using Netlify UI (Easiest)

1. **Go to Netlify**
   - Visit: https://app.netlify.com/
   - Click "Add new site" → "Import an existing project"

2. **Connect GitHub**
   - Choose "GitHub"
   - Authorize Netlify
   - Select your repository

3. **Configure Build**
   - Base directory: `landing`
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Click "Deploy site"

### Option B: Using Netlify CLI (Alternative)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
cd /Users/takiacademy/Downloads/landing/landing
netlify init
```

## Step 4: Add Environment Variables (3 minutes)

In Netlify dashboard:
1. Go to your site → "Site configuration" → "Environment variables"
2. Add these variables:

```plaintext
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
NEXT_PUBLIC_SITE_URL=https://your-site.netlify.app
RESEND_API_KEY=your_resend_key
```

3. Click "Trigger deploy" → "Deploy site"

## Step 5: Update Supabase URLs (2 minutes)

1. **Go to Supabase Dashboard**
   - Authentication → URL Configuration

2. **Add your Netlify URL:**
   ```
   Site URL: https://your-site.netlify.app
   
   Redirect URLs:
   https://your-site.netlify.app/api/auth/callback
   https://your-site.netlify.app/*
   ```

3. **Save**

## Step 6: Update Google OAuth (2 minutes)

1. **Go to Google Cloud Console**
   - APIs & Services → Credentials

2. **Update your OAuth Client:**
   - Authorized JavaScript origins:
     - Add: `https://your-site.netlify.app`
   
   - Authorized redirect URIs:
     - Keep: `https://YOUR_SUPABASE_REF.supabase.co/auth/v1/callback`

3. **Save**

## Step 7: Test Your Site! 🎉

Visit your Netlify URL and test:
- ✅ Homepage
- ✅ Sign in/Sign up
- ✅ Google OAuth
- ✅ Products page
- ✅ Cart & Checkout

---

## That's It! 🎊

Your site is now live! Every time you push to GitHub, Netlify will automatically redeploy.

**Your next push will be automatic:**
```bash
git add .
git commit -m "Update something"
git push
# Netlify deploys automatically!
```

---

## Need Help?

- 📖 Full guide: See `NETLIFY-DEPLOYMENT.md`
- 🐛 Issues? Check the "Common Issues" section in the full guide
- 💬 Questions? Check Netlify deploy logs

**Deployment time:** ~3-5 minutes  
**Your site will be at:** `https://your-name-123.netlify.app`

You can change the domain name in Netlify settings!

