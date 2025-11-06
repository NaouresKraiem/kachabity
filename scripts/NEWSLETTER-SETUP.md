# Newsletter System Setup Guide

This guide will help you set up the complete newsletter subscription system using Supabase + Resend.

## 📋 Prerequisites

- Supabase project
- Resend account (free tier: 3,000 emails/month)

## 🚀 Step 1: Create Supabase Table

Run the SQL migration to create the `newsletter_subscribers` table:

```bash
# In Supabase SQL Editor, run:
landing/scripts/create-newsletter-table.sql
```

Or manually execute in Supabase Dashboard → SQL Editor.

## 🔑 Step 2: Get Resend API Key

1. Sign up at [resend.com](https://resend.com)
2. Go to API Keys section
3. Create a new API key
4. Copy the API key (starts with `re_`)

## 📧 Step 3: Verify Your Domain (Optional but Recommended)

For production, verify your domain in Resend:

1. Go to Domains in Resend dashboard
2. Add your domain (e.g., `kachabity.com`)
3. Add the DNS records to your domain provider
4. Wait for verification

For testing, you can use: `onboarding@resend.dev`

## ⚙️ Step 4: Set Environment Variables

Create/update your `.env.local` file:

```env
# Resend Configuration
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=newsletter@yourdomain.com
# Or for testing: onboarding@resend.dev

# Site URL (for unsubscribe links)
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
# Or for local: http://localhost:3000
```

## 📦 Step 5: Install Resend Package

```bash
npm install resend
```

## ✅ Step 6: Test the System

1. Start your development server:
```bash
npm run dev
```

2. Navigate to your website footer
3. Enter an email in the newsletter form
4. Check:
   - ✅ Email is stored in Supabase `newsletter_subscribers` table
   - ✅ Welcome email is sent to the subscriber
   - ✅ Unsubscribe link works

## 🔍 Verify in Supabase

Check the `newsletter_subscribers` table:
- Email should be stored
- Status should be 'active'
- Timestamp should be recorded

## 📊 Features Implemented

✅ Email validation
✅ Duplicate email handling
✅ Welcome email with Resend
✅ Unsubscribe functionality
✅ Status tracking (active/unsubscribed)
✅ IP address and user agent logging
✅ Re-subscription support
✅ Error handling

## 🎨 Customize Welcome Email

Edit the email template in:
`app/api/newsletter/subscribe/route.ts`

## 📧 Send Newsletter Campaigns

### Option 1: Use Resend Dashboard
1. Go to Resend dashboard
2. Create a new email
3. Use the subscriber list from Supabase

### Option 2: Create Custom API Route
Create an admin route to send campaigns to all active subscribers.

## 🔒 Security Notes

- Newsletter subscription is public (anyone can subscribe)
- Viewing/managing subscribers requires authentication
- API keys are server-side only
- Rate limiting recommended for production

## 🚨 Troubleshooting

**Issue: Email not sent**
- Check RESEND_API_KEY is correct
- Verify RESEND_FROM_EMAIL is valid
- Check Resend dashboard for errors

**Issue: Duplicate email error**
- System handles this automatically
- Returns friendly message to user

**Issue: Unsubscribe not working**
- Check NEXT_PUBLIC_SITE_URL is set correctly
- Verify Supabase connection

## 📈 Next Steps

1. **Analytics**: Track open rates and clicks in Resend
2. **Segmentation**: Add tags/categories to subscribers
3. **Automation**: Send welcome series or abandoned cart emails
4. **Admin Panel**: Build UI to manage subscribers
5. **A/B Testing**: Test different email content

## 💰 Cost Estimates

### Resend Free Tier
- 3,000 emails/month
- 100 emails/day
- Perfect for small to medium businesses

### Paid Plans (if needed)
- $20/month: 50,000 emails
- $80/month: 250,000 emails

### Supabase
- Free: 500MB database, 50,000 MAU
- Newsletter table uses minimal storage

## 🎉 You're All Set!

Your newsletter system is now ready to collect subscribers and send beautiful emails!

