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
# Public JWT signing keys, copied from https://<project>.supabase.co/auth/v1/.well-known/jwks.json
# (one line of JSON). Middleware verifies admin sessions with them instead of downloading them
# on each new server instance. Update it if you rotate the project's signing keys.
SUPABASE_JWKS={"keys":[...]}

# Back-office roles that don't depend on the account (comma-separated emails, server only).
# Owners can do everything, are the only ones who manage other owners, and receive owner
# alerts (deletes and unusual actions by admins and staff). Admins can do everything else.
OWNER_EMAILS=you@yourdomain.com
ADMIN_EMAILS=manager@yourdomain.com

# Custom recipient for contact forms (defaults to GMAIL_USER)
CONTACT_TO_EMAIL=business@yourdomain.com

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Optional external stock API key. Send it as the `x-api-key` request header
# when calling GET /api/stock/inventory. Keep this value secret.
STOCK_API_KEY=replace-with-a-long-random-key

NEXT_PUBLIC_PHONE=+216 55 558 648
NEXT_PUBLIC_ADRESS=Your Address
NEXT_PUBLIC_LOCATION=Your Location

# Social Media Links
NEXT_PUBLIC_FACEBOOK_URL=https://www.facebook.com/profile.php?id=61562718525332
NEXT_PUBLIC_INSTAGRAM_URL=https://www.instagram.com/kachabitii/
NEXT_PUBLIC_TIKTOK_URL=https://www.tiktok.com/@kachabitii

# Currency & Shipping
NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD=100
NEXT_PUBLIC_DEFAULT_SHIPPING_COST=7
NEXT_PUBLIC_CURRENCY=TND
NEXT_PUBLIC_WALLET_NAME=Your Wallet Name

# Deployment environment: "local" on developer machines, "production" on Netlify.
# Read in code through lib/app-env.ts; also used as the Sentry environment.
ENV=local

# Sentry error monitoring (settings per ENV in lib/sentry-options.ts; `next dev` never reports).
# Projects: kachabiti-front-end-prod, kachabiti-backend-prod, kachabiti-local.
# The local project is shared by browser and backend. Production uses one project per runtime.
NEXT_PUBLIC_SENTRY_DSN_LOCAL=https://<local-key>@<org>.ingest.sentry.io/<local-project-id>
NEXT_PUBLIC_SENTRY_DSN_FRONTEND_PRODUCTION=https://<frontend-key>@<org>.ingest.sentry.io/<frontend-project-id>
NEXT_PUBLIC_SENTRY_DSN_BACKEND_PRODUCTION=https://<backend-key>@<org>.ingest.sentry.io/<backend-project-id>
# Optional legacy fallback for existing deployments:
# NEXT_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project-id>
# Build-time only, for readable stack traces (source map upload). Set on Netlify.
# Token: Sentry → Settings → Auth Tokens (Organization token). Server-only, keep secret.
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

## How to Get Gmail App Password

See `GMAIL-SMTP-SETUP.md` for detailed instructions.
