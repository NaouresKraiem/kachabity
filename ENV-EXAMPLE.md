# Environment Variables Example

Copy this to `.env.local` for local development or add to Vercel/Netlify for production.

## Required Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Gmail SMTP Configuration (for sending emails)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
```

## Optional Variables

```env
# Custom recipient for contact forms (defaults to GMAIL_USER)
CONTACT_TO_EMAIL=business@yourdomain.com

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_PHONE=+216 55 558 648
NEXT_PUBLIC_EMAIL=contact@yourdomain.com
NEXT_PUBLIC_ADRESS=Your Address
NEXT_PUBLIC_LOCATION=Your Location

# Social Media Links
NEXT_PUBLIC_FACEBOOK_URL=https://facebook.com/yourpage
NEXT_PUBLIC_INSTAGRAM_URL=https://instagram.com/yourpage
NEXT_PUBLIC_TIKTOK_URL=https://tiktok.com/@yourpage

# Currency & Shipping
NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD=100
NEXT_PUBLIC_DEFAULT_SHIPPING_COST=7
NEXT_PUBLIC_CURRENCY=TND
NEXT_PUBLIC_WALLET_NAME=Your Wallet Name
```

## How to Get Gmail App Password

See `GMAIL-SMTP-SETUP.md` for detailed instructions.
