# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 15 App Router storefront using TypeScript, React 19, Tailwind CSS, Ant Design, and Supabase.

- `app/` contains routes, layouts, metadata, localized pages under `app/[locale]/`, admin pages, and API handlers under `app/api/`.
- `components/` contains reusable UI grouped by feature (`cart/`, `products/`, `forms/`, `sections/`, and `admin/`). Prefer the existing barrel exports such as `components/products/index.ts`.
- `lib/` contains data access, Supabase integration, business logic, schemas, and utilities; shared React hooks live in `hooks/`.
- `public/` stores static images and icons. `types/` contains shared TypeScript declarations.
- `scripts/` contains the WooCommerce catalog importer (`scripts/import-woocommerce.mjs` plus its data in `scripts/import/`). Database schema lives in `supabase/migrations/`.

## Build, Test, and Development Commands

Run `npm install` once, then use:

- `npm run dev` — start the Turbopack development server at `http://localhost:3000`.
- `npm run lint` — run the Next.js ESLint configuration.
- `npm run build` — create a production build with Turbopack.
- `npm start` — serve a completed production build.
- `npm run import:woocommerce` — import the WooCommerce product export (add `-- --dry-run` to preview).

There is currently no test runner or `test` script. For changes affecting routes or data flows, manually exercise the relevant localized, admin, and API paths in development and run lint plus a production build.

## Coding Style & Naming Conventions

Use strict TypeScript with two-space indentation, semicolons, and the existing ESLint rules. Use `PascalCase` for React components and component files, `camelCase` for functions and variables, and kebab-case for utility/schema filenames (for example, `checkout-schema.ts`). Use the `@/*` import alias and keep feature-specific code in its existing directory. Add client components only when browser state or events require them.

## Testing Guidelines

No automated test framework or coverage threshold is configured. Before submitting changes, run `npm run lint` and `npm run build`; verify affected UI flows and API responses locally, especially authentication, checkout, admin, and Supabase-backed features.

## Commit & Pull Request Guidelines

Write short, imperative commit subjects that describe one focused change (for example, `Fix checkout validation`). Pull requests should explain the user-visible or data-model impact, list verification commands, call out required environment or SQL changes, and include screenshots for UI changes. Keep generated `.next/` output and secrets out of commits.

## Security & Configuration

Use local environment files for Supabase, email, and other secrets; never commit `.env` values. Review row-level-security and migration SQL in `supabase/migrations/` before applying database changes, and avoid logging credentials or customer data.
