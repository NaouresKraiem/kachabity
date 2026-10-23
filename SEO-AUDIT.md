# Kachabity SEO audit (https://kachabity.vercel.app), 2026-10-16

Report only. No code was changed. Evidence comes from curl and the built-in browser on the live site, plus the repo code. No SEO tool (Ahrefs/Semrush/GSC) is connected, so keyword demand and difficulty are qualitative estimates, not measured volumes.

## Executive summary

The site has good raw material: real Arabic, French and English product names, server-rendered home page with a keyword-rich H1 ("Kachabia, burnous et dengri, faits en Tunisie"), fast TTFB (~150 ms), zero layout shift, and clean, keyword-bearing product slugs (`kachabia-laine-zemnia-homme-224`). **But today it is close to un-indexable.** Three problems block almost everything else:

1. **Every page declares `https://your-ecommerce-site.com` as its canonical**, and its hreflang and og:url point there too. Google will either ignore the pages or treat a foreign placeholder domain as the original.
2. **Product and category pages ship no content in the HTML.** Product pages server-render only "Chargement du produit..." (no H1, no price, no description). Category and listing pages are client components that render 0 product links and reuse the generic home title.
3. **There is no production domain decision.** The code points at four different domains (`kachabity.tn`, `kachabiti.tn`, `artisan-kraiem.com`, `your-ecommerce-site.com`), none of which resolve, while the brand's **old WooCommerce shop `kachabiti.com` is still live and indexed** (Google shows it for "kachabia" shopping searches). Launching the new site without 301s from it would throw away the brand's existing rankings.

Overall: **critical issues**, but they are concentrated in a few files and most are quick fixes.

## Decision needed before any work

**Which domain will be canonical?** Recommended: keep `kachabiti.com` (it already has rankings, backlinks and brand searches) and point it at the new Next.js app, with 301s from the old WooCommerce URLs. If you prefer `kachabity.tn`, the same 301 map is still required, from kachabiti.com to the new domain. Everything below assumes a single `SITE_URL` constant.

Note: CLAUDE.md says the site deploys on Netlify, but the audited URL is on Vercel. Whichever host serves production must have `NEXT_PUBLIC_SITE_URL` set.

## Technical SEO checklist

| Check | Status | Details and root cause |
|---|---|---|
| Canonical tags | **Fail (critical)** | All pages: `<link rel="canonical" href="https://your-ecommerce-site.com">`. Cause: hard-coded placeholder in `generateMetadata` in `app/[locale]/layout.tsx` (`metadataBase`, `openGraph.url`, `alternates.canonical`). Pages never override it, so the product page inherits it too. The root `app/layout.tsx` has a third value (`https://artisan-kraiem.com`). |
| hreflang | **Fail** | Points at `your-ecommerce-site.com/{en,fr,ar}` home only, on every page, so a product page claims the home page as its alternate. No `x-default`. Needs per-page `alternates.languages` built from the current path. |
| robots.txt | Warning | Served (200, `app/robots.ts`), allows everything. But `Sitemap:` points at `https://kachabity.tn/sitemap.xml`, which doesn't resolve. Should also disallow `/admin`, `/api`, `/*/checkout`, `/*/cart`, `/*/auth`, `/*/settings`, `/*/order-confirmation`. |
| XML sitemap | **Fail** | `app/sitemap.ts` lists 5 static URLs on `kachabity.tn`, without locale prefixes (each one would 307 anyway). No products and no categories. Needs every live product and category × 3 locales, with `alternates.languages` and a real `lastModified` (`updated_at`). |
| Locale redirects | Warning | `/` → 307 `/ar/` → 308 `/ar` (two hops, temporary). Cause: `middleware.ts` builds `/${locale}${pathname}`, which adds a trailing slash for `/`. Use `/${locale}` for the root. Redirecting by Accept-Language is fine for users, but Googlebot then only sees `/ar`; the hreflang and sitemap fix lets it discover `/fr` and `/en`. Consider 308 or keep 307 deliberately, and add `x-default` pointing at `/ar`. |
| Product page HTML | **Fail (critical)** | `ProductDetailClient.tsx` starts with `loading = true` and copies `initialData` into state inside `useEffect`, so the server HTML is just the spinner even though the server already has the data. Fix: initialise `product`, `similarProducts`, etc. from `initialData` and `loading` from `initialData === undefined`. |
| Category / listing HTML | **Fail (critical)** | `app/[locale]/categories/[slug]/page.tsx`, `categories/page.tsx` and `products/page.tsx` are `"use client"` pages that fetch from Supabase in `useEffect`: no H1 in HTML, 0 product links, generic home title. Need a server `page.tsx` with `generateMetadata` that loads the category and first page of products (via `lib/catalog-cache.ts`) and passes it to a client component. |
| Duplicate category URLs | Warning | The home page links categories as `/ar/products?category=kachabia-laine`, while `/ar/categories/kachabia-laine` also exists. Pick `/categories/[slug]` as the indexable URL, link to it everywhere (`components/landing/*`, `components/layout/*`), and canonicalise `?category=` and filter/sort params to it. |
| Soft 404s | **Fail** | `/fr/products/does-not-exist` returns **200**. `generateMetadata` returns `{}` and the page renders anyway. Call `notFound()` from `next/navigation` in `products/[slug]/page.tsx` (and the future server category page) when the record is missing. |
| Structured data | **Fail** | Only an `Organization` block, emitted **twice** with conflicting data: `app/layout.tsx` (kachabiti.tn, logo.svg) and `app/[locale]/layout.tsx` (your-ecommerce-site.com, fake "123 Artisan Street"). No `Product`/`Offer` (price TND, availability, `MadeToOrder` vs `InStock`), no `BreadcrumbList`, no `FAQPage` for the home FAQ, no `WebSite`. |
| Meta descriptions | Warning | Home and all non-product pages use one per-locale description that mentions "HBarnous ROSSINI, Serviette de table" and, in FR/AR, another brand ("Artisan par Kraiem", "حرفي من قبل كريم"). |
| Open Graph / social | Fail | og:image on locale pages is `your-ecommerce-site.com/og-image.jpg` (broken). Product pages override with the main photo (good). |
| Google verification | Fail | `verification.google: "your-google-verification-code"` placeholder in both layouts. Search Console isn't set up through it. |
| HTTPS | Pass | Vercel serves HTTPS. Mixed content not observed. |
| Core Web Vitals (lab) | Pass/Warning | `/fr` in the built-in browser: TTFB ~150 ms, DCL ~1.0 s, load ~1.7 s, CLS 0.000, 470 KB JS over 22 files, 10 images (~300 KB) via `next/image`. On the product page LCP will be poor because the photo only appears after hydration (same root cause as the spinner). No CrUX field data is available for a vercel.app host. |
| Mobile | Pass | Responsive viewport, mobile tab bar, buy bar. |
| Image alt text | Warning | Home page: 6 of 87 images without alt and 2 with "Decorative". Product gallery thumbnails use `alt=""` (`ProductDetailClient.tsx:693`). Main and gallery images should use the localised product name + colour. |
| `<html lang>` and direction | Pass | `lang` follows the locale. `dir="rtl"` is set on the content wrapper. |

## On-page issues by page type

| Page | Issue | Severity | Recommended fix |
|---|---|---|---|
| All | Canonical / hreflang / og:url on placeholder domain | Critical | Single `SITE_URL` in `lib/` (from `NEXT_PUBLIC_SITE_URL`). Per-page `alternates: { canonical: `${SITE_URL}/${locale}${path}`, languages: { ar, fr, en, 'x-default' } }`. |
| Home `/ar` `/fr` `/en` | Title "Kachabity - Produits Traditionnels Artisanaux \| Qualité Premium" is generic and doesn't use the words people search. | High | FR: "Kachabia, burnous et jebba tunisiens faits main \| Kachabity" (~55 chars). AR: "قشابية، برنوس وجبة تونسية صنع يدوي \| Kachabity". EN: "Handmade Tunisian kachabia, burnous & jebba \| Kachabity". |
| Home | Description mentions "HBarnous ROSSINI", "Serviette de table" and another brand | High | Rewrite per locale around kachabia/burnous, wool/cashmere, cash on delivery, delivery across Tunisia. File: `metadataByLocale` in `app/[locale]/layout.tsx`. |
| Home | Brand spelled Kachabity and Kachabiti in the same page | Medium | Pick one spelling (the old domain uses Kachabiti) and keep the other in `alternateName` in the Organization schema. |
| Home | FAQ is server-rendered (good) but has no `FAQPage` JSON-LD | Low | Add JSON-LD in `components/sections/FAQ.tsx`. |
| Category | No server HTML, generic title, no H1 in HTML, no intro text | Critical | Server `page.tsx` + `generateMetadata` ("Kachabia en laine pour homme \| Kachabity"), H1 = localised category name, 80–150 words of category copy (stored per locale in `categories`, e.g. `description_ar/fr`), BreadcrumbList. |
| Category | Two URL patterns (`/categories/x` vs `/products?category=x`) | High | Link to `/categories/[slug]` and canonicalise filters. |
| Product | Spinner only in HTML: no H1, price, description, images | Critical | Initialise state from `initialData` in `ProductDetailClient.tsx`. |
| Product | Title like "kachabia kachmir  \| Kachabity" (lower case, double space, misspelt "kachmir") | High | Build the title from category + name + key attribute, trimmed: "Kachabia cachemire homme – fait main en Tunisie \| Kachabity". Clean names in `scripts/import/translations.json` / admin. |
| Product | Description = first 160 chars cut mid-word | Medium | Cut on a word boundary and add price/delivery ("349 DT, paiement à la livraison"). |
| Product | No Product/Offer/Breadcrumb schema | High | JSON-LD in `products/[slug]/page.tsx`: name, images, `sku`, brand, `offers` (TND, discounted price from `product_discounts`, `availability` InStock or MadeToOrder from `stock_tracked`/`stock`), `aggregateRating` only when reviews exist. |
| Product | Unknown slug returns 200 | High | `notFound()`. |
| About, contact, legal | All share the home title and description; `about` and `contact` are client components | Medium | Add `generateMetadata` per page (server wrapper). |

## Keyword opportunities

Demand and difficulty are judged from Google's results (thin, mostly small WooCommerce shops and encyclopedia pages), not measured. "Current ranking": the new site isn't indexed under its own canonical, so it doesn't rank. The old kachabiti.com does appear for kachabia shopping searches.

| Keyword | Lang | Est. difficulty | Opportunity | Intent | Target page |
|---|---|---|---|---|---|
| kachabia / kachabiya / qachabia | FR/Latin | Easy–moderate | High | Commercial | Kachabia category hub |
| قشابية | AR | Easy | High | Commercial | Kachabia category (AR) |
| kachabia homme / قشابية رجالي | FR/AR | Easy | High | Transactional | Kachabia homme category |
| kachabia cachemire / قشابية كشمير / وبر ماعز | FR/AR | Easy | High | Transactional | Cashmere category |
| kachabia laine / قشابية صوف | FR/AR | Easy | High | Transactional | Wool category |
| kachabia prix tunisie / سوم القشابية | FR/Darija | Easy | High | Commercial | Category copy + price in titles |
| burnous tunisien / برنوس تونسي | FR/AR | Moderate | High | Commercial | Burnous category |
| burnous wabri / برنوس وبري | FR/AR | Easy | High | Transactional | Burnous product pages |
| burnous mariage / برنوس عرس | FR/AR | Easy | High | Commercial, seasonal | Landing page "Burnous du marié" |
| jebba homme / جبة رجالي | FR/AR | Moderate | Medium | Transactional | Jebba category (if sold) |
| jebba tunisienne femme | FR | Moderate (chillandlit.tn, myjebba.com) | Medium | Transactional | Only if the range exists |
| blouza djerbienne / بلوزة جربية | FR/AR | Easy | High | Transactional | `blouza-djerbienne` category |
| dengri tunisien / دنقري | FR/AR | Easy | High | Transactional | `dengri-tunisien` category |
| chechia tunisienne / شاشية | FR/AR | Moderate | Medium | Transactional | `chechia-tunisienne` category |
| balgha / بلغة | FR/AR | Easy | Medium | Transactional | `balgha` category |
| kachabia enfant / قشابية اطفال | FR/AR | Easy | Medium | Transactional | Children category |
| kachabia femme | FR | Easy | Medium | Transactional | Women filter or category |
| cadeau traditionnel tunisien | FR | Moderate | Medium | Commercial | Gift guide |
| différence kachabia et burnous | FR | Easy | Medium | Informational | Guide article |
| comment laver une kachabia en laine | FR/AR | Easy | Medium | Informational | Care guide |
| tunisian kachabia / burnous buy online | EN | Easy | Medium (diaspora) | Transactional | EN category pages |
| kachabiti / kachabity | Brand | Easy | High | Navigational | Home + Organization schema |

Spelling matters: people type kachabia, kachabiya, qachabia, kachabiya and Darija "9achabia". Put the main spelling in titles and H1s, and the variants in category copy and `search_text` (search already normalises them).

## Content gaps

| Topic | Why | Format | Priority | Effort |
|---|---|---|---|---|
| Category intro copy (kachabia, burnous, dengri, blouza, chechia, balgha) in 3 languages | Category pages are the natural targets for head terms and have no text | 100–150 words per category per locale, stored in `categories` | High | Moderate |
| Product descriptions with material, region (Kef, Zemnia, Djerba), sizes, care | Several titles are bare ("kachabia kachmir") | Product copy in admin | High | Substantial (per product) |
| "Kachabia ou burnous : quelle différence ?" | Informational searches; Wikipedia-type pages own them today | Guide (ar/fr), links to both categories | Medium | Half day |
| Size guide and wool care guide | Reduces returns; long-tail "taille kachabia" | Static pages | Medium | Half day |
| "Burnous du marié" seasonal page | Wedding season demand, high basket | Landing page | Medium | Half day |
| Artisan stories (where and who makes it) | E-E-A-T and links from Tunisian press | About page rewrite + articles | Low | Multi-day |

There is no blog/guide section in `app/[locale]/` today. One route (`app/[locale]/guides/[slug]`) would cover the informational keywords.

## Competitors

| Dimension | Kachabity (new) | kachabiti.com (your own old shop) | handmadetunisia.com | chillandlit.tn |
|---|---|---|---|---|
| Indexable product/category HTML | No (spinner / client-rendered) | Yes (WooCommerce) | Yes | Yes |
| Canonical | Placeholder domain | Correct | Correct | Correct |
| Structured data | Organization only (×2, conflicting) | AIOSEO (WP) | WebSite, CollectionPage, BreadcrumbList | Not observed |
| Languages | ar/fr/en (broken hreflang) | fr/ar | fr | fr (hreflang fr) |
| Visible in Google for kachabia shopping searches | No | Yes | Yes (burnous, kachabiste) | Yes for jebba femme |
| Speed / UX | Faster, modern app | Elementor WP, heavier | WP | PrestaShop |

Other small sellers seen in results: nejmaethlela.com (embroidered women's kachabia, 550 TND), giftytn.com, ileycom.com, elaoula.com. The niche is weak: small shops, little content, no strong brand. Fixing the technical blockers alone should be enough to compete; content then decides who leads.

Backlinks, keyword counts and SERP features couldn't be measured without an SEO tool (Ahrefs/Similarweb are installed in the marketing plugin but need authorising).

## Prioritised action plan

### Quick wins (this week)

1. **Choose the domain and set one `SITE_URL`.** Replace every hard-coded domain in `app/layout.tsx`, `app/[locale]/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`. Impact: high. Effort: 1 h. Depends on the domain decision.
2. **Per-page canonical + hreflang (+ x-default).** `app/[locale]/layout.tsx` (remove the global canonical), and `generateMetadata` in each page. Impact: high. Effort: 2 h.
3. **Server-render product pages.** Initialise state from `initialData` in `app/[locale]/products/[slug]/ProductDetailClient.tsx`. Impact: very high. Effort: 1–2 h.
4. **`notFound()` for unknown products.** `app/[locale]/products/[slug]/page.tsx`. Impact: medium. Effort: 15 min.
5. **Rewrite home titles/descriptions** in `metadataByLocale` (remove "HBarnous ROSSINI", "Serviette de table", "Artisan par Kraiem"). Impact: high. Effort: 1 h.
6. **One Organization JSON-LD** with correct data (drop the fake street address), in `app/layout.tsx` only. Impact: medium. Effort: 30 min.
7. **Fix robots.txt** (disallow admin/api/cart/checkout/auth/settings, correct sitemap URL). `app/robots.ts`. Impact: medium. Effort: 15 min.
8. **Fix the double redirect** on `/` in `middleware.ts`. Impact: low. Effort: 15 min.
9. **Search Console**: real verification code (env var) in `app/layout.tsx`, submit the sitemap. Impact: high (visibility into indexing). Effort: 30 min.

### Strategic (this quarter)

1. **301 map from kachabiti.com.** Old product URLs are `/produit/<arabic-slug>/`; new slugs end with the WooCommerce ID (`scripts/import-woocommerce.mjs:232`), so a map from the old export's ID and permalink to the new slug can be generated, plus category and page redirects (Next `redirects()` in `next.config.ts`, or a middleware lookup). Do it on the day the domain switches. Impact: very high. Effort: 1 day.
2. **Dynamic sitemap** of products and categories × 3 locales with hreflang alternates and `updated_at`. `app/sitemap.ts` reading via `lib/catalog-cache.ts`. Impact: high. Effort: half day.
3. **Server category pages.** Rebuild `app/[locale]/categories/[slug]/page.tsx` (and `categories/page.tsx`, `products/page.tsx`) as server pages with `generateMetadata`, H1, intro copy and the first page of products in HTML; client component for filters. Make `/categories/[slug]` the only indexable category URL and update home links. Impact: very high. Effort: 1–2 days.
4. **Product, Offer and BreadcrumbList JSON-LD** (prices from `product_discounts`, availability from `stock_tracked`/`stock`), FAQPage on home. Impact: high (rich results with price in TND). Effort: half day.
5. **Category and product copy in 3 languages**, targeting the keyword table (needs `description_*` columns on `categories` via a migration, and admin fields). Impact: high. Effort: multi-day, ongoing.
6. **Guides section** (`app/[locale]/guides/[slug]`): kachabia vs burnous, size guide, wool care, burnous du marié. Impact: medium. Effort: multi-day.
7. **Image SEO**: localised alt text on every product image (`ProductDetailClient.tsx`, `ProductListCard.tsx`), descriptive file names on upload. Impact: medium (Google Images matters for clothing). Effort: half day.
8. **Measure**: after the switch, connect Search Console/Ahrefs and rerun this audit with real rankings and CrUX field data.

## Sources

- [Kachabiti (old shop)](https://kachabiti.com/fr/)
- [Handmade Tunisia – vêtements](https://www.handmadetunisia.com/categorie-produit/mode-vetements-homme-femme/)
- [Chill&Lit – jebba](https://chillandlit.tn/250-jebba)
- [Nejma et Hlela – kachabia brodée](https://nejmaethlela.com/produit/kachabia-beige-brodee-nh/)
- [Giftytn – kachabia](https://giftytn.com/product/kachabia-traditionelle-tunisienne-veste-artisanal/)
- [MY JEBBA](https://myjebba.com/)
- [ElAoula – jebba homme](https://www.elaoula.com/produit/artisanat-jebba-pour-homme-6-pieces-bleu/)
- [Vikidia – Kachabiya](https://fr.vikidia.org/wiki/Kachabiya)
