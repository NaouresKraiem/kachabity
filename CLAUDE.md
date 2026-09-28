# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` holds the repository conventions (naming, commit style, PR expectations) and applies here as well.

## Commands

- `npm run dev`: Turbopack dev server on http://localhost:3000
- `npm run lint`: ESLint (flat config in `eslint.config.mjs`)
- `npm run build`: production build with Turbopack
- `npm run import:woocommerce -- --dry-run`: preview a re-import of the WooCommerce export (`kachabiti-products.csv`); drop `--dry-run` to write. It is idempotent: products are upserted by slug and their variants, images and discounts replaced. English/French text lives in `scripts/import/translations.json` and `descriptions.json`, and color hexes in `colors.json`.
- `supabase db query --linked -f <file>`: run SQL against the linked project (`hwxgibxahqdxkzuvfxvz`)
- `supabase db advisors --linked`: Supabase security/performance lints
- `npx tsc --noEmit`: type-check. **Run this yourself**: `next.config.ts` sets `ignoreBuildErrors` and `ignoreDuringBuilds`, so `npm run build` succeeds even when there are type or lint errors.

The repo has no test runner. To verify a change, run lint and a type-check, then exercise the affected localized, admin, and API routes in the dev server.

## Architecture

Kachabity is a Next.js 15 App Router storefront for handcrafted Tunisian products. It uses React 19, Tailwind v4, Ant Design 6 (with `@ant-design/v5-patch-for-react-19`), and Supabase as the database, auth, and storage backend. It deploys to Netlify (`netlify.toml`, `@netlify/plugin-nextjs`).

### Routing and middleware

`middleware.ts` handles two separate jobs:

1. **Admin gate.** Requests to `/admin/*` (except `/admin/login`) and "protected" API requests resolve the Supabase user from auth cookies and check `isAdminUser()` in `lib/admin-auth.ts`. A user is an admin if `app_metadata.role` is `'admin'` or their email is in the comma-separated `ADMIN_EMAILS` env var. Never trust `user_metadata`, because users can edit it themselves. The cookies are set by `/admin/login` through the cookie-backed client in `lib/supabase-browser.ts`. The storefront client (`lib/supabaseClient.ts`) keeps its session in localStorage, so middleware cannot see it. The protected API rules are:
   - any non-GET request to a path in `ADMIN_MUTATION_PATHS`
   - `GET /api/products?admin=true`
   - any `/api/orders` request that isn't a POST
   - all of `/api/cart/analytics`

   **When you add an admin-only API route or method, register it in `ADMIN_MUTATION_PATHS` / `isProtectedApiRequest`.** The route handlers themselves do not re-check auth.
2. **Locale prefixing.** Every storefront page lives under `app/[locale]/`. A path with no locale is redirected to one detected from `Accept-Language`. `/admin`, `/api`, and `/api-docs` are left unlocalized.

### Internationalization

The supported locales are `en`, `fr`, and `ar`, and the **default is `ar`** (RTL). All of this is defined in `lib/language-utils.ts` (`isRTL`, `detectLanguageFromHeader`, `isValidLocale`). `next-intl` is installed but largely unused. The actual i18n works like this:
- Locale comes from the route param and is exposed to client components through `LanguageProvider` / `useLanguage()` (`lib/language-context.tsx`).
- UI strings sit in inline per-component `translations = { en, fr, ar }` objects.
- `<html lang>` comes from the `x-locale` header set in `middleware.ts`, and `LanguageProvider` updates it after client-side locale switches. RTL is applied per section with `isRTL()`, not on `<html dir>`.
- `hero_sections.sort_order` controls placement: 0–1 are the right-hand cards, 2 is the left card, and 3 and above are carousel slides.
- Database content has per-locale columns (`name`, `name_ar`, `name_fr`, `description_ar`, …). Pick the right one with the helpers in `lib/utils/product-utils.ts`, which fall back to the base column.

### Supabase access

Env settings live in `lib/supabase-env.ts`. It reads `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, falling back to the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`. There are three clients:
- `lib/supabaseClient.ts`: publishable-key singleton, used by `lib/*` data modules, pages, and client components. It is subject to RLS.
- `lib/supabase-admin.ts`: **service-role** client for API routes, which bypasses RLS. Most admin routes use it. `app/api/products`, `categories`, `orders` and `upload` build an equivalent client inline.
- `lib/supabase-browser.ts`: cookie-backed browser client, used only by the admin login and sign-out.

The access model is enforced by RLS:
- The public can read live catalog and content rows only (not soft-deleted, active).
- Shoppers can insert reviews, manage their own `user_favorites`, and read their own orders.
- Every other write goes through `app/api/*` with the service role. That includes checkout: `lib/orders.ts` `createOrder` calls `POST /api/orders`, which verifies the bearer token before setting `user_id`.
- `newsletter_subscribers`, `carts` and `cart_items` are service-role only.

A browser-side `.insert/.update` on any other table will fail. Route it through an API handler instead.

**The schema source of truth is `supabase/migrations/`.** The legacy SQL scripts from the old project have been removed. Categories are nested (`categories.parent_id`): use `getDescendantCategoryIds` (`lib/utils/product-utils.ts`) wherever products are filtered by category. For a new migration, run `supabase migration new <name>`, apply it with `supabase db query --linked -f`, then `supabase migration repair --status applied <version> --linked`, and run the advisors. The storage bucket for uploads is `products`, which is public-read with service-role-only writes.

### Data and business logic (`lib/`)

- `product-discounts.ts`: discounts live only in `product_discounts`, and the product row has no discount column. Every listing must attach them with `getActiveProductDiscounts` (product page, listing, category page, `/api/products/top`, `/api/products/promo`), or prices show undiscounted.
- `cache.ts` is an in-memory TTL cache, per server instance and not shared.
- `product-discounts.ts`: discounts live in a separate `product_discounts` table with date windows, not only in `products.discount_percent`.
- `shipping.ts` and `get-site-settings.ts`: shipping cost, the free-shipping threshold, and per-country tax rates come from the `site_settings` key/value table, `shipping_rates`, and `country_tax_rates`, with hard-coded fallbacks.
- `orders.ts` → `POST /api/orders` → `order-pricing.ts`: checkout is re-priced on the server and nothing client-supplied is stored as an amount.
  - Each unit price must match `round(base or variant price × (1 − valid discount%))`, which is how the product pages build cart prices.
  - Subtotal, shipping (`shipping.ts`) and tax (`get-site-settings.ts`) are recalculated, and item names and images come from the catalog.
  - Mismatches return 409 with `code`: `PRICES_CHANGED`, `TOTALS_CHANGED` or `PRODUCT_UNAVAILABLE`, which the checkout maps to translated messages.
  - If you change how the storefront computes a price, update `allowedUnitPrices` too.
- `order-confirmation-email.ts`: sent from `POST /api/orders` using the stored order, with customer text HTML-escaped. There is deliberately no public "send email" endpoint. `abandoned-cart-email.ts` is also here. Both send through nodemailer/Gmail SMTP (`GMAIL_USER`, `GMAIL_APP_PASSWORD`).
- `cart-context.tsx`: the cart is client-side only (localStorage key `shopping_cart`), provided in `app/[locale]/layout.tsx` along with `CartDrawer`.
- `lib/schemas/`: zod schemas used with react-hook-form (for example, checkout).

### Caching and performance

- **Next.js data cache.** `lib/catalog-cache.ts` wraps public catalog reads in `unstable_cache` with the `catalog` tag and a 5-minute safety revalidate. It covers the product page (`getCachedProductDetail`, from the loader in `lib/product-detail.ts`) and all home page data. The home loaders in `lib/home-data.ts` (featured categories, top and promo products, sale banners, reels, latest reviews) plus the landing and hero data are loaded in `app/[locale]/page.tsx` and passed to the sections as `initial*` props, so they render in the first HTML. Keep new home sections on this pattern instead of fetching in `useEffect` behind a `mounted` flag. `/api/products/top` and `/promo` serve the same cached loaders.
- **Invalidation.** Every admin mutation route (products, variants, product-images, promotions, categories, colors, sizes, sale-banners) calls `invalidateCatalog()` before returning success. **New admin write routes must do the same**, or the storefront serves stale data. Writes that bypass the API (the importer, the Supabase dashboard) show up after at most 5 minutes.
- **Product page.** `app/[locale]/products/[slug]/page.tsx` is a server component that passes cached data to `ProductDetailClient.tsx`. It only fetches reviews client-side.
- **Header and footer** are rendered once in `app/[locale]/layout.tsx`. Don't add `<StaticHeader />` or `<Footer />` to pages.
- **Browser-side caching.** `lib/categories-cache.ts` shares the category list across pages. `next.config.ts` sets `staleTimes` so the client router cache makes revisits instant.
- **Admin lists** use `GET /api/products?admin=true&view=summary` (no variants, about 50 KB). The full payload is about 1 MB, so use it only for a single product (`?id=`).
- **Middleware auth** uses `supabase.auth.getClaims()`, which verifies locally because the project uses ES256 signing keys, instead of a network `getUser()`.
- `next dev` roughly doubles Supabase calls (React Strict Mode effects) and compiles pages on demand, so judge performance on a production build.

### Admin

Ant Design is used **only in the admin**; the storefront uses Tailwind plus `react-hot-toast`. Don't import `antd` in `app/[locale]` or `components/` outside `components/admin`, because it adds about 500 kB to every page. In admin forms, an `InputNumber` inside `Space.Compact` must sit in a `noStyle` `Form.Item` (see the Base Price field), or the value never reaches the form. `app/admin/` is a client-rendered Ant Design dashboard (layout in `app/admin/layout.tsx`, theme in `lib/antd-config.ts`). It covers products, variants, categories, orders, promotions, sale banners, reels, and cart analytics, and it reads and writes through the `app/api/*` routes.

### API docs

`lib/openapi.ts` builds an OpenAPI spec by hand. `/api/docs` serves it and `/api-docs` renders it with swagger-ui. If you change an API route's shape, update this spec too.

## Configuration notes

- The env var names are listed in `ENV-EXAMPLE.md`. `ADMIN_EMAILS` and `SUPABASE_SERVICE_ROLE_KEY` are server-only.
- `next.config.ts` whitelists remote image hosts, including the project's Supabase storage host. Add any new image source there.
- The many top-level `*.md` files are historical setup and fix notes. Treat them as background, not as the current source of truth.
