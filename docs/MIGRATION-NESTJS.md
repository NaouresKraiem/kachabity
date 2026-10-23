# Migration plan: Next.js + NestJS + plain Postgres

Branch: `kachabiti-nest`. Goal: move off Supabase to a NestJS API and a plain Postgres database,
keeping the Next.js storefront and admin, without a big-bang rewrite and without downtime beyond
one short database cut-over.

Task-by-task steps for phase 0 and the first module: [MIGRATION-NESTJS-TASKS.md](MIGRATION-NESTJS-TASKS.md).

## Where we start (measured on this branch)

| Piece | Today | Size |
|---|---|---|
| API | Next.js route handlers in `app/api/*` | 65 routes |
| Business logic | Postgres functions and triggers in `supabase/migrations/` (orders, stock, payments, accounting, reports) | ~50 functions called by RPC, plus triggers |
| Data access | `supabase-js` (PostgREST): `supabase.from` 211 calls, `supabase.rpc` 63 calls | `app/api`, `lib/*` |
| Browser reads | storefront reads the catalog directly with the publishable key, protected by RLS | `lib/*` data modules |
| Auth | Supabase Auth, email + password only (no Google/Facebook); admin roles in `app_metadata`; `auth.uid()` in 12 RLS policies; 7 foreign keys to `auth.users` | 38 `supabase.auth` calls |
| Files | Supabase Storage: `products` (public), `documents` (private, signed links) | 5 call sites |
| Realtime | notification bell listens to `notifications` | 1 channel |
| Jobs | `pg_cron` (daily alerts), `pg_net` + Vault + Edge Function `send-push` (desktop push) | |
| Activity log | actor read from PostgREST request headers (`private.trusted_request_headers()`) | |
| Hosting | Netlify (serverless functions) + Supabase | |

The key fact: most of the logic already lives in Postgres and moves with the database as it is.
NestJS replaces PostgREST, Supabase Auth, Storage, Realtime and the Edge Function, not the
business rules.

## Target architecture

```
kachabity/
  (root)            Next.js (storefront + admin UI), unchanged; app/api empties as areas move
  api/              NestJS: every /api route, auth, files, notifications, jobs
  lib/              shared by both apps (NestJS imports it through the @shared/* path alias)
  supabase/migrations/  stays the schema source; made Supabase-free in phase 3–5
```

- **Database access in NestJS: Kysely**, a typed query builder with types generated from the live
  schema by `kysely-codegen`. It reads like today's `supabase.from(...)` chains, keeps raw SQL easy
  for the many `select fn(...)` calls, and doesn't take over migrations. Migrations stay plain SQL
  files, run with `dbmate`.
- **One server to start**: `web` and `api` in Docker Compose on one VPS; Postgres managed or on the
  same machine with daily backups; files on Cloudflare R2 (S3-compatible, free egress).
- **Routing**: the browser keeps calling `/api/...`; Next.js rewrites `/api/:path*` to the NestJS
  server. Front-end URLs don't change, and routes can move one at a time.

## Supabase features and their replacements

| Supabase feature | Replacement | Notes |
|---|---|---|
| PostgREST + RLS | NestJS controllers + guards | RLS stops being the security layer: every query filters `deleted_at` and checks permissions in code. Keep RLS on as a second line during the transition. |
| Auth (users, passwords, sessions) | NestJS `AuthModule`: `users` table, httpOnly cookie sessions (access + refresh JWT), `@nestjs/jwt`, `argon2` for new passwords | Supabase stores **bcrypt** hashes in `auth.users.encrypted_password`: copy them as they are, verify with bcrypt, re-hash with argon2 at the next sign-in. Nobody has to reset a password. |
| `app_metadata.role / permissions` | `users.role`, `users.permissions` columns | `lib/admin-auth.ts` ports unchanged; it only reads these two fields. |
| `requirementFor()` in `middleware.ts` | NestJS global guard + `@Requires('orders')`, `@OwnerOnly()` decorators | Same rule table, moved to the API. Next.js middleware keeps only page redirects and locale prefixing. |
| Storage `products` (public) | R2 bucket behind a CDN domain (e.g. `media.kachabiti.com`) | Copy files, then rewrite stored URLs (`product_images.image_url`, reels, hero sections…) in one SQL update. |
| Storage `documents` (private) | private R2 bucket + presigned URLs (5 min) | Same behaviour as today's signed links. |
| Realtime (notification bell) | Server-Sent Events endpoint in NestJS fed by Postgres `LISTEN/NOTIFY` | One trigger `pg_notify('notifications', recipient_id)`; simpler than WebSockets. |
| `pg_cron` daily alerts | `@nestjs/schedule` cron calling `select private.daily_alerts()` | Or keep pg_cron if the Postgres host offers it. |
| `pg_net` + Vault + Edge Function `send-push` | NestJS `NotificationsModule` with the `web-push` library, triggered by the same `LISTEN/NOTIFY` | Drop `private.dispatch_push`; VAPID keys move to env vars. |
| Activity-log actor headers | `set_config('app.actor_id', …, true)` at the start of each transaction | Rewrite `private.trusted_request_headers()` to read these settings. Every NestJS write goes through one `withActor(actor, trx => …)` helper. |
| `service_role` / `anon` / `authenticated` grants | one application role (`kachabity_app`) + one read-only role for reporting | Grants rewritten in one migration. |
| Extensions `pg_trgm`, `unaccent`, `pg_cron` | available on standard Postgres 17 | `pg_net` and Vault are dropped. |

## Database changes (one migration set, written once)

1. Create `public.users` with the **same uuid** as `auth.users.id` (email, password_hash, role,
   permissions, created_at, deleted_at, last_sign_in_at) and copy the rows from `auth.users`.
2. Repoint the 7 foreign keys from `auth.users` to `public.users`; replace `auth.uid()` in the 12
   RLS policies with `current_setting('app.user_id', true)::uuid`.
3. Replace `private.trusted_request_headers()` (actor from settings, see above).
4. Drop `private.dispatch_push`, the `pg_net` / Vault dependency and the `supabase_realtime`
   publication; add the `pg_notify` trigger on `notifications`.
5. Replace the Supabase role grants with the application role.

Keeping ids identical means orders, `created_by`, `assigned_to`, the activity log and notifications
keep pointing at the right people, with no data rewrite.

## Phases

Each phase ships on its own and can be rolled back. The site keeps running on Supabase until
phase 5.

### Phase 0: Prepare (2–3 days)
- **Start from the ERP code.** The ERP work is committed on `feature/erp-modules` (its pull request
  goes to `main`; its migrations aren't applied to the live database yet). Rebase `kachabiti-nest`
  on it once merged, so the migration starts from the code that's live.
- Create `api/` (NestJS 11, Node 22) next to the Next.js app, sharing `lib/` through a path alias.
- NestJS basics: config module (env validated with zod), Kysely connected to the **current
  Supabase Postgres** through the pooler, Sentry, health check, Dockerfile.
- Next.js `rewrites()` for `/api/:path*` → NestJS, behind a per-route allow-list so routes switch
  one at a time.

### Phase 1: Move the API, area by area (3–5 weeks)
Same Supabase database, same Supabase Auth: NestJS verifies Supabase JWTs (JWKS), so sign-in is
untouched. Port in this order, lowest risk first, moving each group from `app/api` to a NestJS
module and flipping its rewrite:

| Order | NestJS module | Routes today |
|---|---|---|
| 1 | `CatalogModule` | products, categories, colors, sizes, variants, product-images, promotions, sale-banners, reels, landing, products/top, products/promo |
| 2 | `StockModule` | stock/* |
| 3 | `OrdersModule` (pricing, confirmation email) | orders, sales/orders, sales/payments, sales/remittances |
| 4 | `DeliveryModule` (Colissimo) | delivery |
| 5 | `CustomersModule` | customers, crm/*, webhooks/meta |
| 6 | `PosModule`, `PurchasingModule` | pos, purchasing/* |
| 7 | `FinanceModule` | finance/* (bills, treasury, invoices, accounting, reports, bank, documents) |
| 8 | `OwnerModule`, `TeamModule`, `NotificationsModule` | owner/*, admin/* |
| 9 | small routes | contact, newsletter, cart/*, upload/image, docs |

Rules while porting:
- Keep the response shapes (`{ success, data }` / `{ success: false, error, code }`) so the admin
  screens don't change. `lib/erp/api.ts` (`route`, `readBody`, `must`, `DB_MESSAGES`) becomes a
  NestJS exception filter and validation pipe.
- Keep every `rpc(...)` as `select fn(...)`; don't rewrite database functions in TypeScript.
- Bring the end-to-end test suite (74 checks: orders, payments, till, purchasing, accounting,
  goals, permissions) into the `api` package first and run it after each area moves.

### Phase 2: Browser and server components stop calling Supabase (1–2 weeks)
- Replace the `lib/*` data modules that use the publishable key (storefront catalog, reviews,
  favorites, customer orders) with calls to the NestJS API. Server components call the API over
  the internal network; keep `unstable_cache` + `invalidateCatalog()` (the API calls
  `revalidateTag` through a small authenticated Next.js endpoint).
- After this phase, only auth and storage still talk to Supabase from the browser.

### Phase 3: Auth (1–2 weeks)
- Database changes 1–2; copy `auth.users` into `public.users` with their bcrypt hashes.
- NestJS endpoints: sign-in, sign-out, refresh, shopper sign-up, password reset by e-mail
  (nodemailer is already in place), change password; port team management (`/api/admin/team`).
- Switch the admin login and the storefront account pages; both use httpOnly cookies (today the
  storefront session sits in localStorage).
- Rollback: leave Supabase Auth untouched until the new sign-in has run for a week.

### Phase 4: Files, realtime, push, jobs (1 week)
- Copy the `products` and `documents` buckets to R2 (`rclone`), rewrite URLs, switch uploads.
- SSE notification stream + `pg_notify` trigger; port `NotificationBell`.
- Push sending in NestJS (`web-push`); daily alerts cron in NestJS.

### Phase 5: Move the database (2–3 days, plus a one-night cut-over)
- Provision Postgres 17 (managed, or on the VPS with WAL backups to R2); run the Supabase-free
  migrations on an empty database to prove they apply from zero.
- Rehearse: `pg_dump` the live data (schemas `public` and `private`, with the users copy), restore,
  run the end-to-end suite against it.
- Cut-over (about 30 minutes, at night): site in read-only mode, final dump and restore, switch
  `DATABASE_URL`, smoke test, reopen.
- Keep the Supabase project paused, not deleted, for a month as a fallback.

### Phase 6: Clean up (2–3 days)
- Remove `@supabase/*`, `lib/supabase*.ts`, `supabase/functions` and the Supabase-only env vars.
- Move hosting from Netlify to the VPS (or keep Netlify for `web` only); update `CLAUDE.md`.

**Total: about 9–14 weeks for one developer**, most of it in phase 1.

## Hosting and cost (estimates to confirm)

| Item | Option | Rough monthly cost |
|---|---|---|
| App server (web + api) | Hetzner CPX31 (4 vCPU, 8 GB) or an OVH equivalent | ~15 € |
| Postgres | same VPS with backups, or a managed instance | 0–25 € |
| Files + CDN | Cloudflare R2 (no egress fees) | ~0–5 € |
| Backups | R2 or a Hetzner storage box | ~3 € |

Check current prices and compare with the last three Supabase invoices before deciding.

## Risks and how the plan handles them

| Risk | Mitigation |
|---|---|
| A permission check is lost when RLS stops protecting data | Deny-by-default global guard (a route needs a decorator to be reachable); the e2e suite checks refusals for agent, cashier and owner |
| Soft-deleted rows leak into lists | A Kysely helper that adds `deleted_at is null`; a review checklist item |
| The activity log loses the actor | `withActor()` is the only way to open a write transaction; e2e asserts activity rows have an actor |
| Password migration fails | Same uuids, bcrypt verification, Supabase Auth kept as a fallback for a week |
| Data loss at cut-over | Rehearsed restore, read-only window, Supabase kept paused for a month |
| Losing serverless auto-scaling | One Node server handles this shop's traffic; add a second API container behind the proxy if needed |

## Decisions needed before phase 0

1. **Database host:** managed Postgres or self-managed on the VPS?
2. **Hosting:** keep Netlify for the Next.js app, or move everything to one VPS?
3. **ERP work:** merge it to `main` and apply its migrations to the live database before starting?
