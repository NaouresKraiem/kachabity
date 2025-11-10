# Gmail SMTP Setup Guide

Your app now uses **Gmail SMTP** instead of Resend for sending emails. No domain verification needed!

## ✅ Benefits

- **500 emails/day FREE** (more than Resend's 100/day)
- **No domain verification** required
- **Works immediately** with any Gmail account
- **Perfect for Tunisia** (no regional restrictions)

---

## 📧 Step 1: Create Gmail App Password

### 1. Enable 2-Factor Authentication on Gmail

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click **2-Step Verification**
3. Follow the steps to enable it (required for app passwords)

### 2. Generate App Password

1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select app: **Mail**
3. Select device: **Other (Custom name)**
4. Enter name: **Kachabity Website**
5. Click **Generate**
6. **Copy the 16-character password** (e.g., `abcd efgh ijkl mnop`)

---

## 🔧 Step 2: Update Environment Variables

### Local Development (.env.local):

```env
# Gmail SMTP Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop

# Optional: Custom recipient for contact forms
CONTACT_TO_EMAIL=business@yourdomain.com

# Your site URL (for newsletter links)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Production (Vercel/Netlify):

Add these environment variables in your deployment dashboard:

| Variable | Value | Example |
|----------|-------|---------|
| `GMAIL_USER` | Your Gmail address | `kachabity@gmail.com` |
| `GMAIL_APP_PASSWORD` | 16-char app password | `abcdefghijklmnop` |
| `CONTACT_TO_EMAIL` | Where contact forms go | `support@kachabity.com` |
| `NEXT_PUBLIC_SITE_URL` | Your website URL | `https://kachabity.com` |

---

## 📝 Step 3: Remove Old Resend Variables

You can now **delete** these old variables:

- ~~`RESEND_API_KEY`~~
- ~~`RESEND_FROM_EMAIL`~~

They're no longer needed!

---

## 🧪 Step 4: Test Email Sending

### Test Contact Form:
1. Go to your site's contact page
2. Fill out the form
3. Submit it
4. Check your Gmail for the message

### Test Newsletter:
1. Subscribe to newsletter on your site
2. Check the subscriber's inbox for welcome email

### Test Order Confirmation:
1. Place a test order
2. Check customer email for confirmation

---

## 🔍 Troubleshooting

### Issue: "Invalid login" error

**Solution:**
- Make sure 2FA is enabled on Gmail
- Generate a fresh App Password
- Use the password **without spaces** (remove spaces between groups)
- Double-check `GMAIL_USER` is correct

### Issue: "Less secure app" error

**Solution:**
- **Don't use** your regular Gmail password
- **Must use** the 16-character App Password
- Make sure the App Password was generated correctly

### Issue: Emails not sending

**Solution:**
```bash
# Check environment variables are set
console.log(process.env.GMAIL_USER) // Should show your email
console.log(process.env.GMAIL_APP_PASSWORD) // Should show password

# Check logs for errors
```

### Issue: "Daily limit exceeded"

**Solution:**
- Gmail free accounts: **500 emails/day max**
- Wait 24 hours or upgrade to Google Workspace
- Google Workspace: **2,000 emails/day**

---

## 📊 Email Limits

### Free Gmail Account:
- ✅ **500 emails per day**
- ✅ No cost
- ✅ Perfect for small to medium sites

### Google Workspace (Paid):
- ✅ **2,000 emails per day**
- ✅ Custom domain email (@yourdomain.com)
- ✅ Better for large businesses
- 💰 ~$6/month per user

---

## 🔒 Security Best Practices

1. **Never commit** `.env.local` to Git (it's in `.gitignore`)
2. **Use different Gmail** for production vs development
3. **Rotate App Passwords** every few months
4. **Monitor your Gmail** sent folder for unusual activity
5. **Enable alerts** in Gmail for suspicious activity

---

## 📧 What Emails Are Sent?

### 1. Contact Form (`/api/contact`)
- **To**: `CONTACT_TO_EMAIL` or `GMAIL_USER`
- **When**: Customer submits contact form
- **Content**: Name, email, phone, message

### 2. Newsletter Welcome (`/api/newsletter/subscribe`)
- **To**: Subscriber's email
- **When**: Someone subscribes to newsletter
- **Content**: Welcome message with shop link

### 3. Order Confirmation (`sendOrderConfirmationEmail`)
- **To**: Customer's email
- **When**: Order is placed
- **Content**: Order details, items, shipping address

---

## 🚀 Deployment Steps

### For Vercel:

1. Push your code to Git
2. Go to Vercel Dashboard → Your Project
3. Settings → Environment Variables
4. Add `GMAIL_USER` and `GMAIL_APP_PASSWORD`
5. Redeploy

### For Netlify:

1. Push your code to Git
2. Go to Netlify Dashboard → Your Site
3. Site configuration → Environment variables
4. Add `GMAIL_USER` and `GMAIL_APP_PASSWORD`
5. Trigger deploy

---

## 📋 Quick Setup Checklist

- [ ] Enable 2FA on Gmail
- [ ] Generate App Password
- [ ] Add `GMAIL_USER` to `.env.local`
- [ ] Add `GMAIL_APP_PASSWORD` to `.env.local`
- [ ] Test locally with `npm run dev`
- [ ] Add variables to Vercel/Netlify
- [ ] Deploy and test in production
- [ ] Remove old Resend variables

---

## 💡 Tips

### Use a Dedicated Gmail Account
Create a separate Gmail account for your business:
- Example: `noreply@kachabity.com` (via Google Workspace)
- Or: `kachabity.notifications@gmail.com` (free Gmail)

### Monitor Email Usage
Check Gmail → Settings → Filters and Blocked Addresses to create auto-labels for:
- Contact form emails
- Newsletter confirmations
- Order confirmations

### Backup Email Service
Keep Resend as backup in case you hit Gmail limits:
```typescript
// Try Gmail first, fallback to Resend
try {
  await sendWithGmail();
} catch (error) {
  await sendWithResend();
}
```

---

## 🆘 Need Help?

- Gmail App Passwords: https://support.google.com/accounts/answer/185833
- Nodemailer Docs: https://nodemailer.com/
- Your code: Check `/app/api/contact/route.ts` for implementation

---

## 🎉 You're All Set!

Your app now sends emails through Gmail SMTP with:
- ✅ 500 free emails per day
- ✅ No domain verification
- ✅ Works in Tunisia
- ✅ Professional delivery

Happy emailing! 📬

