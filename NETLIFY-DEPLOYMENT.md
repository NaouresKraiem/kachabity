# Netlify Deployment Guide

This guide will help you deploy your Next.js e-commerce application to Netlify.

## Prerequisites

- GitHub/GitLab/Bitbucket account
- Netlify account (free tier available)
- Project pushed to a Git repository
- Environment variables configured

## Step 1: Prepare Your Project

### 1.1 Verify Build Locally

Before deploying, ensure your project builds successfully:

```bash
npm run build
```

If the build is successful, you're ready to deploy!

### 1.2 Required Files

Your project already includes:
- ✅ `netlify.toml` - Netlify configuration
- ✅ `package.json` - Dependencies and scripts
- ✅ `.gitignore` - Excludes node_modules and .env files

## Step 2: Connect to Netlify

### Option A: Deploy via Netlify UI (Recommended)

1. **Sign Up/Login to Netlify**
   - Go to [https://www.netlify.com/](https://www.netlify.com/)
   - Sign up or log in with your Git provider

2. **Create New Site**
   - Click "Add new site" → "Import an existing project"
   - Choose your Git provider (GitHub, GitLab, or Bitbucket)
   - Authorize Netlify to access your repositories

3. **Select Repository**
   - Find and select your project repository
   - Click on the repository name

4. **Configure Build Settings**
   - **Branch to deploy:** `main` (or your default branch)
   - **Base directory:** `landing`
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   - **Functions directory:** Leave empty (handled by @netlify/plugin-nextjs)

5. **Click "Deploy site"**
   - Netlify will assign a random subdomain (e.g., `random-name-123.netlify.app`)
   - You can change this later in Site settings

### Option B: Deploy via Netlify CLI

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**
   ```bash
   netlify login
   ```

3. **Initialize Netlify**
   ```bash
   cd landing
   netlify init
   ```

4. **Follow the prompts:**
   - Create & configure a new site
   - Choose your team
   - Enter site name (optional)
   - Build command: `npm run build`
   - Publish directory: `.next`

5. **Deploy**
   ```bash
   netlify deploy --prod
   ```

## Step 3: Configure Environment Variables

1. **Go to Site Settings**
   - In your Netlify dashboard, select your site
   - Navigate to "Site configuration" → "Environment variables"

2. **Add Required Variables**

   Click "Add a variable" and add each of the following:

   ```plaintext
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_SITE_URL=https://your-site.netlify.app
   RESEND_API_KEY=your_resend_api_key
   ```

   **Important Environment Variables:**
   - `NEXT_PUBLIC_SUPABASE_URL` - From Supabase Dashboard → Settings → API
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - From Supabase Dashboard → Settings → API
   - `NEXT_PUBLIC_SITE_URL` - Your Netlify site URL
   - `RESEND_API_KEY` - From Resend Dashboard (for emails)

3. **Save and Redeploy**
   - After adding variables, trigger a new deploy
   - Go to "Deploys" tab → "Trigger deploy" → "Deploy site"

## Step 4: Configure Custom Domain (Optional)

1. **Add Custom Domain**
   - Go to "Domain management" → "Add custom domain"
   - Enter your domain name (e.g., `kachabity.com`)
   - Follow Netlify's instructions to update DNS settings

2. **Configure DNS**
   - Add Netlify's nameservers to your domain registrar, OR
   - Add A record pointing to Netlify's IP
   - Add CNAME record for www subdomain

3. **SSL Certificate**
   - Netlify automatically provisions a free SSL certificate
   - Wait a few minutes for SSL to activate

## Step 5: Update Supabase OAuth Callback URLs

1. **Go to Supabase Dashboard**
   - Navigate to Authentication → URL Configuration

2. **Add Netlify URLs**
   - **Site URL:** `https://your-site.netlify.app`
   - **Redirect URLs:** Add the following:
     ```
     https://your-site.netlify.app/api/auth/callback
     https://your-site.netlify.app/*
     ```

3. **Update Google OAuth**
   - Go to Google Cloud Console
   - Update "Authorized JavaScript origins":
     - Add: `https://your-site.netlify.app`
   - Update "Authorized redirect URIs":
     - Add: `https://YOUR_SUPABASE_REF.supabase.co/auth/v1/callback`

## Step 6: Test Your Deployment

1. **Visit Your Site**
   - Open your Netlify URL in a browser
   - Test all major features:
     - ✅ Homepage loads correctly
     - ✅ Products page displays items
     - ✅ Authentication (sign up/sign in)
     - ✅ Google OAuth works
     - ✅ Cart functionality
     - ✅ Checkout process
     - ✅ Email notifications

2. **Check Deploy Logs**
   - If something doesn't work, check deploy logs
   - Go to "Deploys" → Click on the latest deploy → "Deploy log"

## Common Issues & Solutions

### Issue: "Build Failed"

**Solution:**
- Check the build logs in Netlify dashboard
- Ensure all dependencies are in `package.json`
- Verify Node version (should be 20+)
- Try building locally first: `npm run build`

### Issue: "Environment Variables Not Working"

**Solution:**
- Ensure variables are prefixed with `NEXT_PUBLIC_` for client-side access
- Redeploy after adding/changing environment variables
- Check for typos in variable names
- Clear cache and redeploy: "Deploys" → "Trigger deploy" → "Clear cache and deploy site"

### Issue: "API Routes Returning 404"

**Solution:**
- Ensure `@netlify/plugin-nextjs` is in your dependencies
- Check `netlify.toml` configuration is correct
- Verify base directory is set to `landing`

### Issue: "OAuth Redirect Not Working"

**Solution:**
- Verify callback URLs in Supabase match your Netlify URL
- Check Google/Facebook OAuth redirect URIs
- Ensure `NEXT_PUBLIC_SITE_URL` is set correctly
- Check that OAuth callback route (`/api/auth/callback`) is accessible

### Issue: "Images Not Loading"

**Solution:**
- Ensure images are in the `public` folder
- Check image paths are correct (use `/assets/...` not `./assets/...`)
- Verify Supabase storage URLs are publicly accessible

### Issue: "Slow Build Times"

**Solution:**
- Enable build cache in Netlify settings
- Consider upgrading to Netlify Pro for faster builds
- Optimize dependencies (remove unused packages)

## Netlify Features to Explore

### 1. **Deploy Previews**
- Every pull request gets a unique deploy preview URL
- Perfect for testing before merging to main

### 2. **Branch Deploys**
- Deploy specific branches automatically
- Great for staging environments

### 3. **Build Hooks**
- Trigger deployments via webhook
- Useful for CMS integrations

### 4. **Forms**
- Netlify can handle form submissions
- Could be used for contact forms

### 5. **Analytics**
- Basic analytics available in free tier
- Upgrade for more detailed insights

## Continuous Deployment

Once set up, Netlify automatically deploys when you push to your repository:

1. Make changes to your code locally
2. Commit and push to GitHub
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
3. Netlify automatically detects the push and deploys
4. Wait 2-5 minutes for deployment to complete
5. Your site is live with the new changes!

## Performance Optimization

### 1. **Enable Build Cache**
- Speeds up subsequent builds
- Enabled by default with `@netlify/plugin-nextjs`

### 2. **Asset Optimization**
- Enable "Asset optimization" in Site settings
- Compresses CSS, JS, and images

### 3. **CDN**
- Netlify automatically serves your site via global CDN
- No additional configuration needed

### 4. **Headers**
Add custom headers in `netlify.toml`:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
```

## Monitoring & Logs

### Real-time Logs
- Go to "Deploys" → Click on a deploy → "Functions log"
- Shows real-time function execution logs

### Error Tracking
- Netlify shows build and runtime errors in dashboard
- Consider integrating Sentry for advanced error tracking

## Cost Considerations

### Free Tier Includes:
- 100 GB bandwidth/month
- 300 build minutes/month
- Unlimited sites
- Deploy previews
- SSL certificates
- Basic forms

### When to Upgrade:
- Exceeding bandwidth limits
- Need faster builds
- Require advanced analytics
- Need team collaboration features

## Security Best Practices

1. **Never commit `.env` files** - Already in `.gitignore`
2. **Use environment variables** for all secrets
3. **Enable HTTPS** - Automatic with Netlify
4. **Set security headers** - Add to `netlify.toml`
5. **Restrict OAuth origins** - Only allow your production domain
6. **Monitor access logs** - Check Netlify analytics regularly

## Rollback Deployments

If something goes wrong:

1. Go to "Deploys" tab
2. Find a previous successful deploy
3. Click "..." → "Publish deploy"
4. Your site rolls back instantly

## Support Resources

- [Netlify Documentation](https://docs.netlify.com/)
- [Next.js on Netlify](https://docs.netlify.com/frameworks/next-js/overview/)
- [Netlify Community Forums](https://answers.netlify.com/)
- [Netlify Status](https://www.netlifystatus.com/)

## Next Steps After Deployment

1. ✅ Test all functionality thoroughly
2. ✅ Set up custom domain
3. ✅ Configure email DNS records (for Resend)
4. ✅ Enable analytics
5. ✅ Set up monitoring/alerts
6. ✅ Create staging environment (separate branch)
7. ✅ Document deployment process for your team
8. ✅ Set up automated testing (optional)

---

## Quick Deployment Checklist

- [ ] Project builds successfully locally
- [ ] All environment variables documented
- [ ] Repository pushed to Git
- [ ] Connected repository to Netlify
- [ ] Configured build settings
- [ ] Added all environment variables
- [ ] Updated Supabase callback URLs
- [ ] Updated OAuth provider URLs (Google/Facebook)
- [ ] Tested authentication flow
- [ ] Tested checkout process
- [ ] Verified email notifications work
- [ ] Set up custom domain (optional)
- [ ] Enabled HTTPS
- [ ] Reviewed security settings

Congratulations! Your e-commerce site is now live on Netlify! 🎉

