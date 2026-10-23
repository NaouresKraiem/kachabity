# Run the whole app locally in Docker

A local copy of the site to test on: storefront + admin (Next.js), the NestJS API, and a local
Supabase (database, sign-in, storage, realtime, Studio), optionally filled with the live data.
Nothing here writes to the live project: the live database is only read, by the import script.

Needs Docker Desktop and Node 22.

## 1. Start the local Supabase

```bash
npx supabase start
```

It applies `supabase/migrations/` (config in `supabase/config.toml`). Studio, to browse the data:
http://127.0.0.1:54323. E-mails the app sends (sign-up, password reset) land in http://127.0.0.1:54324.

## 2. Create `.env.docker`

```bash
npm run docker:env
```

It writes `.env.docker` (git-ignored) with the local keys. Then edit it:
- `OWNER_EMAILS`: your e-mail, to get the owner role.
- `SOURCE_DATABASE_URL`: to copy the live data (next step). Take it from the Supabase dashboard →
  **Connect** → **Session pooler**, with the database password. Don't paste live keys anywhere else.

## 3. Copy the live data (optional)

```bash
npm run docker:import
```

It reads the live database and replaces the local data: all products, variants, images, categories,
orders, settings, stock, landing page, and the sign-in accounts (same e-mails and passwords). Then it
applies the migrations the live site doesn't have yet (the ERP ones), the same way a production
rollout would. The dump is kept in `.docker-data/` (git-ignored). It holds customer data, so delete it
when you're done.

Product photos keep their live URLs (live Supabase Storage), so they show as long as the live site is up.

## 4. Build and start the app

```bash
npm run docker:up
```

- Site and admin: http://localhost:3000 (admin: http://localhost:3000/admin)
- NestJS API: http://localhost:4000/api/health. The areas in `NEST_ROUTES` go through it.

The first build takes a few minutes. Rebuild after code changes with the same command. After
changing only `.env.docker`, run `docker compose build --no-cache web`, then `npm run docker:up`:
`NEXT_PUBLIC_*` values and `NEST_ROUTES` are fixed at build time, and Docker doesn't notice a
change in that file on its own. Stop with `docker compose down` and `npx supabase stop`.

## Notes

- The browser reaches Supabase at `localhost:54321`. The web container runs inside the small
  `gateway` container, which forwards its `localhost:54321` to the same Supabase, so one URL works
  on both sides. The api container uses `host.docker.internal`.
- E-mail (Gmail), Colissimo, Meta and Sentry are off unless you add their variables to `.env.docker`.
  Leave them off: with them on, actions in the local copy would send real e-mails and parcels.
- To start again from the live data, run `npm run docker:import` again, then
  `docker compose restart web` so the site drops its cached pages.
