# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` holds the repository conventions (naming, commit style, PR expectations) and applies here as well.

## Commands

- `npm run dev`: Turbopack dev server on http://localhost:3000. It sets `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=2000` because Node's default 250 ms connect attempt times out against Supabase on slow networks, which makes middleware treat signed-in admins as signed out. Use the same flag for `next start` and Node scripts.
- `npm run lint`: ESLint (flat config in `eslint.config.mjs`)
- `npm run build`: production build with Turbopack
- `npm run import:woocommerce -- --dry-run`: preview a re-import of the WooCommerce export (`kachabiti-products.csv`); drop `--dry-run` to write. It is idempotent: products are upserted by slug, variants are matched by color + size and updated in place (never touching stock), and images and discounts are replaced. English/French text lives in `scripts/import/translations.json` and `descriptions.json`, and color hexes in `colors.json`.
- `supabase db query --linked -f <file>`: run SQL against the linked project (`hwxgibxahqdxkzuvfxvz`)
- `supabase db advisors --linked`: Supabase security/performance lints
- `npx tsc --noEmit`: type-check. **Run this yourself**: `next.config.ts` sets `ignoreBuildErrors` and `ignoreDuringBuilds`, so `npm run build` succeeds even when there are type or lint errors.

The repo has no test runner. To verify a change, run lint and a type-check, then exercise the affected localized, admin, and API routes in the dev server.

## Architecture

Kachabity is a Next.js 15 App Router storefront for handcrafted Tunisian products. It uses React 19, Tailwind v4, Ant Design 6 (with `@ant-design/v5-patch-for-react-19`), and Supabase as the database, auth, and storage backend. It deploys to Netlify (`netlify.toml`, `@netlify/plugin-nextjs`).

### Routing and middleware

`middleware.ts` handles two separate jobs:

1. **Back-office gate (roles and permissions).** Requests to `/admin/*` (except `/admin/login`) and back-office API requests resolve the Supabase user from auth cookies (`getClaims()`, so roles come from the JWT). `lib/admin-auth.ts` defines the model:
   - `getAdminRole()`: `'owner'` if `app_metadata.role` is `'owner'` or the email is in `OWNER_EMAILS`; `'admin'` if `app_metadata.role` is `'admin'` or the email is in the comma-separated `ADMIN_EMAILS` env var; `'staff'` if `app_metadata.role` is `'staff'`; otherwise none. Owners and admins have full access (`hasFullAccess`). Only owners can give the owner role or change or delete an owner. Never trust `user_metadata`, because users can edit it themselves.
   - `getPermissions()`: admins have every permission in `PERMISSIONS` (`products`, `stock`, `orders`, `discounts`, `marketing`, `analytics`, `costs`, `delete`, `hard_delete`) plus team management. Staff have the list in `app_metadata.permissions`, or `DEFAULT_STAFF_PERMISSIONS` when there is none. Admins edit these lists in Admin → Team (`/api/admin/team`). Changes reach a session when its JWT refreshes (up to an hour) or at the next sign-in.
   - `requirementFor()` in `middleware.ts` maps each request to what it needs: `PAGE_PERMISSIONS` for admin pages, `MUTATION_PERMISSIONS` for writes to catalog/marketing APIs, explicit rules for `/api/stock/*`, `/api/orders`, `/api/cart/analytics`, `/api/admin/*`. A DELETE needs the area permission **and** `delete`; `/admin/team` and `/api/admin/team` are admin-only. Refused API calls get 403; refused pages redirect to `/admin/dashboard`.
   - Middleware passes the verified identity to route handlers as `x-admin-role` / `x-admin-user-id` / `x-admin-email` / `x-admin-permissions`; read them with `getAdminActor(request.headers)`. The admin UI uses `useAdminRole()` (`lib/admin-role-context.tsx`, fed by `GET /api/admin/me`) and its `can(permission)` only to hide menu entries and controls.
   - The cookies are set by `/admin/login` through the cookie-backed client in `lib/supabase-browser.ts`. The storefront client (`lib/supabaseClient.ts`) keeps its session in localStorage, so middleware cannot see it.

   **When you add a back-office page, API route or method, give it a rule in `requirementFor` (and a menu permission in `MENU_PERMISSIONS` in `app/admin/layout.tsx`).** The route handlers themselves do not re-check auth.
2. **Locale prefixing.** Every storefront page lives under `app/[locale]/`. A path with no locale is redirected to one detected from `Accept-Language`. `/admin`, `/api`, and `/api-docs` are left unlocalized.

### Internationalization

The supported locales are `en`, `fr`, and `ar`, and the **default is `ar`** (RTL). All of this is defined in `lib/language-utils.ts` (`isRTL`, `detectLanguageFromHeader`, `isValidLocale`). `next-intl` is installed but largely unused. The actual i18n works like this:
- Locale comes from the route param and is exposed to client components through `LanguageProvider` / `useLanguage()` (`lib/language-context.tsx`).
- UI strings sit in inline per-component `translations = { en, fr, ar }` objects.
- `<html lang>` comes from the `x-locale` header set in `middleware.ts`, and `LanguageProvider` updates it after client-side locale switches. RTL is applied per section with `isRTL()`, not on `<html dir>`.
- The home page is configured in Admin → Landing page (`/api/landing`, `marketing` permission). Section order and visibility, list sizes, autofill and the spotlight category are stored in the `site_settings` row `landing_config` (JSON, shape and defaults in `lib/landing-config.ts`). Product picks are stored in `landing_products` (sections `new_arrivals`, `showcase`, `ring`, `top_products`, `promo_products`, `spotlight`, saved through the `set_landing_products` RPC). Featured categories use `categories.featured_position` (`set_featured_categories`). In every list, pinned products come first, then the automatic choice if autofill is on. `app/[locale]/page.tsx` renders the sections in the configured order. When you add a home section, add its key to `HOME_SECTIONS`.
- `hero_sections.sort_order` controls placement: 0–1 are the right-hand cards, 2 is the left card, and 3 and above are carousel slides.
- Database content has per-locale columns (`name`, `name_ar`, `name_fr`, `description_ar`, …). Pick the right one with the helpers in `lib/utils/product-utils.ts`, which fall back to the base column.

### Supabase access

Env settings live in `lib/supabase-env.ts`. It reads `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, falling back to the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`. There are three clients:
- `lib/supabaseClient.ts`: publishable-key singleton, used by `lib/*` data modules, pages, and client components. It is subject to RLS.
- `lib/supabase-admin.ts`: **service-role** client for API routes, which bypasses RLS. Every admin route uses it (`/api/cart/analytics` builds an equivalent one).
- Server-side clients use `resilientFetch` (`lib/resilient-fetch.ts`), which retries only when a connection could not be opened (DNS failure, connect timeout), so flaky networks don't surface as random `fetch failed` 500s and writes are never sent twice.
- `lib/supabase-browser.ts`: cookie-backed browser client, used only by the admin login and sign-out.

The access model is enforced by RLS:
- The public can read live catalog and content rows only (not soft-deleted, active).
- Shoppers can insert reviews, manage their own `user_favorites`, and read their own orders.
- Every other write goes through `app/api/*` with the service role. That includes checkout: `lib/orders.ts` `createOrder` calls `POST /api/orders`, which verifies the bearer token before setting `user_id`.
- `newsletter_subscribers`, `carts`, `cart_items` and the stock tables (`locations`, `suppliers`, `collections`, `product_costs`, `inventory_levels`, `stock_movements`) are service-role only.

A browser-side `.insert/.update` on any other table will fail. Route it through an API handler instead.

**Related writes must be one transaction.** supabase-js can't span requests, so any operation that writes more than one row/table that belong together is a Postgres function (`supabase/migrations/20261001170000_transactional_writes.sql`) called with `supabase.rpc()`:
- `create_order` (order + lines)
- `set_order_status` (status + stock movement)
- `delete_orders` (stock restore + mark cancelled and deleted, one or many)
- `save_product` (product, variants, variant photos, photos, opening stock, tracking, importer discount; create and update)
- `record_stock_movements` (all movement types, counts across locations, tracking flag)
- `save_landing_page` (Admin → Landing page: a section's picks, `landing_config` and featured categories)
- `delete_variant` (variant + its photos)
- `purge_deleted` (permanent deletes, see below)

If any step fails, nothing is written. Bulk deletes send `?ids=a,b` and run one statement. When you add a write that touches several rows or tables together, add or extend such a function rather than chaining client calls.

**No hard deletes.** Deleting means `deleted_at = now()`, plus `status = 'archived'` / `active = false` / `is_available = false` where the table has one (orders become `cancelled`). The trigger `private.prevent_hard_delete` rejects `DELETE` on every business table with `hard_delete_not_allowed`. The one way past it is `public.purge_deleted(table, ids)` (service role only), which erases rows that are **already** soft-deleted, along with what cascades from them, and logs each one as `purge`. Admins and staff with the `hard_delete` permission use it from Admin → Deleted items (`/api/admin/trash`, which also needs the table's area permission; the table list is `lib/trash-tables.ts` and must match the function's). The only exception is `inventory_levels`, which the stock trigger maintains; customer and team accounts must be soft-deleted in Supabase Auth too (`deleteUser(id, true)`), because a hard Auth delete would cascade into guarded tables and fail. Every read that bypasses RLS (service role) must add `.is('deleted_at', null)`, including on embeds (`.is('product_images.deleted_at', null)`). Public RLS policies already hide deleted rows. Favorites are removed by setting `deleted_at` and re-added by upsert. Team members are soft-deleted in Supabase Auth (`deleteUser(id, true)`).

**Activity log.** `activity_log` is append-only and filled by the trigger `private.log_activity` on business tables. Each row records the staff member, the action (create/update/delete/restore) and the changed columns as before → after. The actor comes from `x-actor-*` headers (trusted only on service-role requests, via `private.trusted_request_headers()`), which `lib/supabase-admin.ts` adds to every service-role request made during a back-office request (read from the middleware headers via `next/headers`). Requests without a staff member (checkout, scripts) aren't logged; direct database edits are logged with `source = 'database'`. Changes the database can't see (team accounts in Supabase Auth) are logged with `logActivity()` (`lib/activity-log.ts`). Admins browse the log in Admin → Activity (`/api/admin/activity`). Middleware strips client-sent `x-admin-*` headers on every ungated request, so the identity can't be forged.

**Notifications.** The `notifications` table holds one row per recipient, with the title and body stored in en/fr/ar (`private.i18n`).
- **New orders:** a deferred trigger on `orders` notifies the owners, the admins, and staff with `orders`.
- **Owner alerts:** the trigger `private.owner_alerts` on `activity_log` notifies owners about what admins and staff do: deletes (grouped per person over 10 minutes, plus a critical alert past 10), purges, blocked attempts (middleware logs `access_denied`), team changes, price cuts of 50% or more, discounts of 50% or more, stock adjustments of 20+ units, settings changes, cancelled or refunded orders, and restores. Owners' own actions don't alert. Admins receive these alerts while no owner exists.
- **Recipients:** they come from `back_office_users`, which `GET /api/admin/me` and the Team API keep in sync (it includes roles set through `OWNER_EMAILS` / `ADMIN_EMAILS`).
- **In the admin:** the header bell (`components/admin/NotificationBell.tsx`) loads `/api/admin/notifications` and listens through Realtime.
- **Desktop push:** `private.dispatch_push` posts each new row through pg_net to the `send-push` Edge Function (`supabase/functions/send-push`, deployed with `supabase functions deploy send-push --no-verify-jwt --use-api`). The function sends Web Push to the recipient's `push_subscriptions`, shown by `public/admin-sw.js`. Its URL and shared secret live in Vault (`push_function_url`, `push_webhook_secret`). Its secrets are `VAPID_KEYS`, `PUSH_WEBHOOK_SECRET` and `VAPID_SUBJECT`. The browser key is the `vapid_public_key` row in `site_settings`.
- **Adding an alert:** add a rule to `private.owner_alerts`, or call `private.notify(recipients, …)` from SQL.

**The schema source of truth is `supabase/migrations/`.** The legacy SQL scripts from the old project have been removed. Categories are nested (`categories.parent_id`): use `getDescendantCategoryIds` (`lib/utils/product-utils.ts`) wherever products are filtered by category. For a new migration, run `supabase migration new <name>`, apply it with `supabase db query --linked -f`, then `supabase migration repair --status applied <version> --linked`, and run the advisors. The storage bucket for uploads is `products`, which is public-read with service-role-only writes.

### Data and business logic (`lib/`)

- `product-discounts.ts`: discounts live only in `product_discounts`, and the product row has no discount column. Every listing must attach them with `getActiveProductDiscounts` (product page, listing, category page, `/api/products/top`, `/api/products/promo`), or prices show undiscounted.
- `product-search.ts`: product search, used by the header suggestions (`components/layout/SearchBox.tsx`) and the products page (`?search=`). Matching runs in Postgres through `search_products(query)`, which returns ranked ids of live products. It searches `products.search_text`, which a trigger keeps up to date with the names, descriptions and code in all three languages plus the category and parent-category names, all run through `normalize_search_text` (lower case, no accents, Arabic diacritics removed and letter variants unified). Every word must match, in any order, and name matches rank higher. When nothing matches, it falls back to similar spellings with pg_trgm. A search with no explicit sort is shown in relevance order. If you add a searchable field, add it to `private.set_product_search`.
- `cache.ts` is an in-memory TTL cache, per server instance and not shared.
- `shipping.ts` and `get-site-settings.ts`: shipping cost, the free-shipping threshold, and per-country tax rates come from the `site_settings` key/value table, `shipping_rates`, and `country_tax_rates`, with hard-coded fallbacks.
- `orders.ts` → `POST /api/orders` → `order-pricing.ts`: checkout is re-priced on the server and nothing client-supplied is stored as an amount.
  - Each unit price must match `round(base or variant price × (1 − valid discount%))`, which is how the product pages build cart prices.
  - Subtotal, shipping (`shipping.ts`) and tax (`get-site-settings.ts`) are recalculated, and item names and images come from the catalog.
  - Mismatches return 409 with `code`: `PRICES_CHANGED`, `TOTALS_CHANGED` or `PRODUCT_UNAVAILABLE`, which the checkout maps to translated messages.
  - If you change how the storefront computes a price, update `allowedUnitPrices` too.
- `order-confirmation-email.ts`: sent from `POST /api/orders` using the stored order, with customer text HTML-escaped. There is deliberately no public "send email" endpoint. `abandoned-cart-email.ts` is also here. Both send through nodemailer/Gmail SMTP (`GMAIL_USER`, `GMAIL_APP_PASSWORD`).
- `cart-context.tsx`: the cart is client-side only (localStorage key `shopping_cart`), provided in `app/[locale]/layout.tsx` along with `CartDrawer`. Lines are keyed by product + variant (`cartLineKey`); `removeItem`/`updateQuantity` take that key. Product cards add through `useQuickAdd()` (`lib/quick-add.ts`), which opens the product page when a size/color must be chosen.

### Stock

Stock management (formerly a separate app) lives in this database and the admin's Stock section.
- **Never write `product_variants.stock` or `inventory_levels` directly.** Every change is a row in the append-only `stock_movements` (types `restock`, `sale`, `return`, `adjustment`, `transfer`); the trigger `private.apply_stock_movement` updates `inventory_levels` (per variant × location) and rejects negative stock with `insufficient_stock:<sku>:<available>` (`stockErrorMessage()` in `lib/stock.ts` turns it into a message). Record movements through `POST /api/stock/movements` (also does transfers and `count` mode).
- One location has `sells_online`. For products with `stock_tracked = true`, its levels are mirrored into `product_variants.stock`, which the storefront and checkout read. Untracked products (the default, until counted) stay orderable whatever `stock` says: availability is `!stock_tracked || stock > 0`.
- Orders: the admin shows `processing` as **Validated**. The "Validate" button (`validateOrder` in `components/admin/order-status.ts`) moves a pending order to `processing`; this is the hook for handing orders to a delivery company later. `order_items` store `variant_id` and `variant_label`. `PUT /api/orders` calls `apply_order_stock` (idempotent via `orders.stock_deducted`): processing/shipped/delivered deducts tracked items from the online location, pending/cancelled restores them, and a shortage returns 409 without changing the status. Checkout (`order-pricing.ts`) rejects tracked lines over stock (`OUT_OF_STOCK`) or without a variant on multi-variant tracked products (`VARIANT_REQUIRED`).
- Product saves (`save_product`, used by `POST/PUT /api/products` and the importer) update variants in place, matched by id or color + size, because variant ids carry stock. Removing a variant that still holds stock is refused with 409. New products record their opening stock as restock movements and start tracked.
- Product codes and variant SKUs are generated by triggers when left blank. Purchase costs live in `product_costs` (`costs` permission).
- `lib/schemas/`: zod schemas used with react-hook-form (for example, checkout).

### Caching and performance

- **Next.js data cache.** `lib/catalog-cache.ts` wraps public catalog reads in `unstable_cache` with the `catalog` tag and a 5-minute safety revalidate. It covers the product page (`getCachedProductDetail`, from the loader in `lib/product-detail.ts`) and all home page data. The home loaders in `lib/home-data.ts` (featured categories, top and promo products, sale banners, reels, latest reviews) plus the landing and hero data are loaded in `app/[locale]/page.tsx` and passed to the sections as `initial*` props, so they render in the first HTML. Keep new home sections on this pattern instead of fetching in `useEffect` behind a `mounted` flag. `/api/products/top` and `/promo` serve the same cached loaders.
- **Invalidation.** Every admin mutation route (products, variants, product-images, promotions, categories, colors, sizes, sale-banners, stock movements and tracking) calls `invalidateCatalog()` before returning success. **New admin write routes must do the same**, or the storefront serves stale data. Writes that bypass the API (the importer, the Supabase dashboard) show up after at most 5 minutes.
- **Product page.** `app/[locale]/products/[slug]/page.tsx` is a server component that passes cached data to `ProductDetailClient.tsx`. It only fetches reviews client-side.
- **Header and footer** are rendered once in `app/[locale]/layout.tsx`. Don't add `<StaticHeader />` or `<Footer />` to pages.
- **Browser-side caching.** `lib/categories-cache.ts` shares the category list across pages. `next.config.ts` sets `staleTimes` so the client router cache makes revisits instant.
- **Admin lists** use `GET /api/products?admin=true&view=summary` (no variants, about 50 KB). The full payload is about 1 MB, so use it only for a single product (`?id=`).
- **Middleware auth** uses `supabase.auth.getClaims()`, which verifies locally because the project uses ES256 signing keys, instead of a network `getUser()`.
- `next dev` roughly doubles Supabase calls (React Strict Mode effects) and compiles pages on demand, so judge performance on a production build.

### Admin

Ant Design is used **only in the admin**; the storefront uses Tailwind plus `react-hot-toast`. Don't import `antd` in `app/[locale]` or `components/` outside `components/admin`, because it adds about 500 kB to every page. In admin forms, an `InputNumber` inside `Space.Compact` must sit in a `noStyle` `Form.Item` (see the Base Price field), or the value never reaches the form. Import `message` from `@/components/admin/antd-app`, not from `antd`: the admin layout wraps pages in antd's `<App>`, and the static API ignores the theme and warns. For searchable `Select`s whose values are ids, give options a `searchtext` and use `filterOption={searchByText}` (`components/admin/select-search.ts`). The admin layout installs `components/admin/admin-fetch-cache.ts`, which keeps the small lookup lists (categories, colors, sizes, suppliers, collections, locations) in memory for 5 minutes and clears an entry on any write to the same path. `app/admin/` is a client-rendered Ant Design dashboard (layout in `app/admin/layout.tsx`, theme in `lib/antd-config.ts`). It covers products, variants, categories, orders, stock (inventory, movements, restock, settings), team, promotions, sale banners, reels, and cart analytics, and it reads and writes through the `app/api/*` routes.

**Admin language (EN / FR / AR).** The admin has its own language switch in the header (and on the login page), separate from the storefront URL locale. It's remembered per browser:
- Write UI text in English and wrap it: `const { t } = useAdminT()` then `t("Save changes")` or `t("Deleted {count} color(s)", { count })`.
- Text defined outside components (constants) is marked with `msg("…")` and translated where it's displayed with `t(value)`.
- French and Arabic live in `lib/admin-translations.ts` as `[English, French, Arabic]` rows. A missing row falls back to English, so **add a row for every new string**, keeping `{placeholders}` intact.
- Arabic switches antd and the layout to right-to-left; antd's own texts (pagination, OK/Cancel, dates) and dayjs follow the language (`AdminConfig` in `app/admin/layout.tsx`).
- Never translate values that are data (HTTP methods, statuses sent to the API, ids).

### API docs

`lib/openapi.ts` builds an OpenAPI spec by hand. `/api/docs` serves it and `/api-docs` renders it with swagger-ui. If you change an API route's shape, update this spec too.

## Configuration notes

- The env var names are listed in `ENV-EXAMPLE.md`. `ADMIN_EMAILS` and `SUPABASE_SERVICE_ROLE_KEY` are server-only.
- `ENV` is the deployment environment: `local` on developer machines, `production` on Netlify. `next.config.ts` passes it to all code as `NEXT_PUBLIC_APP_ENV`; read it through `APP_ENV` / `isProduction` / `isLocal` in `lib/app-env.ts` rather than `NODE_ENV`, which is `production` for any build, including local ones.
- Fonts are self-hosted with `next/font/local` (`app/fonts/*.woff2`: Inter and Handlee Latin subsets, Reem Kufi Arabic + Latin, variable weights) and wired in `app/layout.tsx` and `lib/fonts.ts`. Don't switch back to `next/font/google`: Turbopack fails the build when the Google Fonts download is slow or offline.
- `next.config.ts` whitelists remote image hosts, including the project's Supabase storage host. Add any new image source there.
- **Error monitoring (Sentry, `@sentry/nextjs` v11).** Init files: `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, loaded by `instrumentation.ts` (which also reports request errors); shared options and the PII scrubber are in `lib/sentry-options.ts`. It only reports from production builds (never `next dev`) with `NEXT_PUBLIC_SENTRY_DSN` set, and its environment tag and sample rates follow `ENV`. Thrown errors are captured automatically; where an error is caught and turned into a response or fallback, call `reportError(error, area)` from `lib/report-error.ts`, and never pass customer details. Browser events go through the `/monitoring` tunnel, which the middleware matcher excludes. In v11, `withSentryConfig` is imported from `@sentry/nextjs/config`.
- The many top-level `*.md` files are historical setup and fix notes. Treat them as background, not as the current source of truth.
