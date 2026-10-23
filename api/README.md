# Kachabity API (NestJS)

The backend the `/api` routes are moving to, area by area. Plan: [docs/MIGRATION-NESTJS.md](../docs/MIGRATION-NESTJS.md),
steps: [docs/MIGRATION-NESTJS-TASKS.md](../docs/MIGRATION-NESTJS-TASKS.md).

## Run

```bash
npm ci
npm run build
npm run start:prod   # needs the variables in .env.example
```

`npm run start:dev` rebuilds on change. The Next.js app sends an area here when it is listed in its
`NEST_ROUTES` (e.g. `NEST_ROUTES=categories`, `NEST_URL=http://localhost:4000`); remove it to send
traffic back to the old route.

## How it fits

- **Shared code:** `@shared/*` is the root `lib/` folder (`lib/admin-auth.ts`, `lib/erp/db-messages.ts`),
  compiled into `dist/lib`. Shared files may only use relative imports.
- **Access (`src/auth`):** deny by default. Every route needs `@Public()`, `@Requires(...)`,
  `@RequiresAll(...)`, `@AdminOnly()` or `@OwnerOnly()`, with the same rules as `requirementFor` in
  `middleware.ts`. The guard verifies the Supabase session (cookie or bearer) against the project's JWKS.
- **Database (`src/db`):** Kysely on `pg`. The connection bypasses RLS, so every read filters
  `deleted_at is null`. Every write goes through `db.withActor(actor, trx => ...)` so the activity
  log records the staff member. Regenerate `src/db/types.ts` after a migration:
  `npm run db:types -- --url "$DATABASE_URL"`.
- **Responses (`src/common/api.ts`):** `{ success, data }` / `{ success: false, error, code }`, as in
  `lib/erp/api.ts`; validate bodies with `@Body(new Zod(schema))`.
- **Catalog writes** call `invalidateCatalog()` (`src/catalog/revalidate.ts`) so the storefront cache refreshes.

## Tests

End-to-end suites in `test/e2e/`, run against a **local** Supabase (`supabase start`) and the app at
`APP_URL` (default `http://localhost:3000`), so they test whichever server answers:

```bash
SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:e2e
```

The ERP suite checks running totals, so it needs a fresh database (`npx supabase db reset`); the
others can run on any data. `node test/e2e/compare.mjs <paths>` checks that a ported GET returns the
same JSON as its Next.js route.

## Docker

From the repository root (the API compiles files from `lib/`):

```bash
docker build -f api/Dockerfile -t kachabity-api .
```
