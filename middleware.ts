import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server';
import { supportedLanguages, defaultLanguage, detectLanguageFromHeader, isValidLocale } from './lib/language-utils';
import { ADMIN_HEADERS, allows, getAdminRole, getPermissions, type AdminRole, type Permission, type Requirement } from './lib/admin-auth';
import { supabaseUrl, supabasePublishableKey } from './lib/supabase-env';
import { TRASH_TABLES, isTrashTable } from './lib/trash-tables';

const ADMIN_LOGIN_PATH = '/admin/login';

const MUTATION_PERMISSIONS: Record<string, Permission[]> = {
    '/api/categories': ['products'],
    '/api/colors': ['products'],
    '/api/sizes': ['products'],
    '/api/variants': ['products'],
    '/api/products': ['products'],
    '/api/product-images': ['products'],
    '/api/upload/image': ['products', 'marketing'],
    '/api/promotions': ['discounts'],
    '/api/sale-banners': ['marketing'],
    '/api/reels': ['marketing'],
    '/api/cart/send-recovery-emails': ['marketing'],
};

// Admin pages by path prefix (longest match wins). Pages not listed need any back-office user.
const PAGE_PERMISSIONS: [string, Requirement][] = [
    ['/admin/overview', { owner: true }],
    ['/admin/team', { admin: true }],
    ['/admin/activity', { admin: true }],
    ['/admin/performance', { admin: true }],
    ['/admin/goals', { admin: true }],
    ['/admin/settings', { admin: true }],
    ['/admin/customers', { any: ['customers'] }],
    ['/admin/pos', { any: ['pos'] }],
    ['/admin/purchasing', { any: ['purchasing'] }],
    ['/admin/finance', { any: ['finance'] }],
    ['/admin/marketing', { any: ['marketing'] }],
    ['/admin/trash', { all: ['hard_delete'] }],
    ['/admin/products', { any: ['products'] }],
    ['/admin/categories', { any: ['products'] }],
    ['/admin/variants', { any: ['products'] }],
    ['/admin/orders', { any: ['orders'] }],
    ['/admin/delivery', { any: ['orders'] }],
    ['/admin/stock', { any: ['stock'] }],
    ['/admin/promotions', { any: ['discounts'] }],
    ['/admin/sale-banners', { any: ['marketing'] }],
    ['/admin/reels', { any: ['marketing'] }],
    ['/admin/landing', { any: ['marketing'] }],
    ['/admin/cart-analytics', { any: ['analytics'] }],
];

const withDelete = (method: string, area: Permission[]): Requirement =>
    method === 'DELETE' ? { any: area, all: ['delete'] } : { any: area };

function requirementFor(request: NextRequest): Requirement | null {
    const { pathname, searchParams } = request.nextUrl;
    const method = request.method.toUpperCase();
    const under = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

    if (under('/admin')) {
        if (pathname === ADMIN_LOGIN_PATH) return null;
        return PAGE_PERMISSIONS.find(([prefix]) => under(prefix))?.[1] ?? { any: [] };
    }

    // The owner's money overview.
    if (under('/api/owner')) return { owner: true };
    if (under('/api/admin/team') || under('/api/admin/activity') || under('/api/admin/performance')) return { admin: true };
    // Objectives and business settings are managed by owners and admins; anyone signed in reads
    // their own objectives through /api/admin/my-work.
    if (under('/api/admin/goals') || under('/api/admin/erp-settings')) return { admin: true };
    // Permanent deletes: `hard_delete` plus the permission of the area the table belongs to.
    if (under('/api/admin/trash')) {
        const table = searchParams.get('table');
        return { all: isTrashTable(table) ? [TRASH_TABLES[table].permission, 'hard_delete'] : ['hard_delete'] };
    }
    if (under('/api/admin')) return { any: [] };
    if (under('/api/stock/costs')) return { any: ['costs'] };
    // Product forms, purchase orders, the till and bills read suppliers, collections and locations too.
    if (['/api/stock/suppliers', '/api/stock/collections', '/api/stock/locations'].some(under) && method === 'GET') {
        return { any: ['stock', 'products', 'purchasing', 'pos', 'finance'] };
    }
    // Purchase orders and the till pick variants from the inventory list.
    if (pathname === '/api/stock/inventory' && method === 'GET') return { any: ['stock', 'purchasing', 'pos'] };
    // Purchasing manages its suppliers (terms, tax id, bank details).
    if (under('/api/stock/suppliers')) return withDelete(method, ['stock', 'purchasing']);
    // Manual orders, assignment, confirmation and duplicate checks.
    if (under('/api/sales/orders')) return withDelete(method, ['orders']);
    // Money received and carrier payouts. Agents can see an order's payments.
    if (under('/api/sales/payments') && method === 'GET') return { any: ['finance', 'orders'] };
    if (under('/api/sales')) return withDelete(method, ['finance']);
    // Order pages look up a customer by phone to warn about duplicates.
    if (under('/api/customers') && method === 'GET') return { any: ['customers', 'orders', 'pos'] };
    if (under('/api/customers') || under('/api/crm')) return withDelete(method, ['customers']);
    if (under('/api/pos')) return withDelete(method, ['pos']);
    if (under('/api/purchasing')) return withDelete(method, ['purchasing']);
    if (under('/api/finance')) return withDelete(method, ['finance']);
    // Campaigns: the order forms list them; marketing manages them and their spend.
    if (under('/api/marketing/campaigns') && method === 'GET') return { any: ['marketing', 'orders', 'finance'] };
    if (under('/api/marketing')) return withDelete(method, ['marketing']);
    if (under('/api/stock')) return withDelete(method, ['stock']);
    if (pathname === '/api/cart/analytics') return { any: ['analytics'] };
    // Home page curation: reads and writes are back-office only.
    if (under('/api/landing')) return { any: ['marketing'] };
    // Admin product lists also feed the discount, banner, stock, order, purchasing and costing screens.
    if (pathname === '/api/products' && searchParams.get('admin') === 'true' && method === 'GET') {
        return { any: ['products', 'discounts', 'marketing', 'stock', 'orders', 'purchasing', 'finance'] };
    }
    if (pathname === '/api/orders' && method !== 'POST') return withDelete(method, ['orders']);
    // Colissimo parcels: sending orders, tracking and removing them from the list.
    if (under('/api/delivery')) return withDelete(method, ['orders']);
    const area = MUTATION_PERMISSIONS[pathname];
    if (area && method !== 'GET') return withDelete(method, area);
    return null;
}

// Only gated requests carry a verified identity (and the activity log trusts it), so any
// identity headers a client sent itself are dropped everywhere else.
function withoutAdminHeaders(request: NextRequest): Headers {
    const headers = new Headers(request.headers);
    Object.values(ADMIN_HEADERS).forEach((name) => headers.delete(name));
    return headers;
}

// Public signing keys from SUPABASE_JWKS (the project's /auth/v1/.well-known/jwks.json), so
// getClaims() can verify sessions without first downloading them. That download is a full
// round trip on every new server instance and every 10 minutes after; on a slow connection
// it made the first admin request take seconds. Without the variable, or after a key
// rotation, getClaims() falls back to fetching the keys itself.
const STATIC_JWKS = (() => {
    try {
        const parsed = JSON.parse(process.env.SUPABASE_JWKS ?? '');
        return Array.isArray(parsed?.keys) && parsed.keys.length ? { keys: parsed.keys } : undefined;
    } catch {
        return undefined;
    }
})();

// Resolves the signed-in user from the auth cookies set by the admin login page.
// Refreshed session cookies are written onto `response` so sessions outlive the
// access-token lifetime.
async function getRequestUser(request: NextRequest, response: NextResponse) {
    if (!supabaseUrl || !supabasePublishableKey) return null;

    const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
                cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
            },
        },
    });

    // getClaims() verifies the JWT locally against the project's (cached) signing keys,
    // so admin pages, prefetches and admin API calls don't each wait on a round trip to
    // Supabase Auth. It still refreshes expired sessions via the cookie handlers above.
    const { data } = await supabase.auth.getClaims(undefined, STATIC_JWKS ? { jwks: STATIC_JWKS } : undefined);
    const claims = data?.claims;
    if (!claims) return null;
    return {
        id: typeof claims.sub === 'string' ? claims.sub : null,
        email: typeof claims.email === 'string' ? claims.email : null,
        app_metadata: (claims.app_metadata ?? {}) as Record<string, unknown>,
    };
}

// A signed-in staff member was refused: recorded in the activity log, which alerts the owner
// (private.owner_alerts). Prefetches are skipped: they aren't something the person did.
function logRefusal(request: NextRequest, event: NextFetchEvent, user: { id: string | null; email: string | null }, role: AdminRole) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const prefetch = request.headers.get('next-router-prefetch') || request.headers.get('purpose') === 'prefetch';
    if (!serviceKey || !supabaseUrl || !user.id || prefetch) return;
    event.waitUntil(
        fetch(`${supabaseUrl}/rest/v1/activity_log`, {
            method: 'POST',
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({
                actor_id: user.id,
                actor_email: user.email,
                actor_role: role,
                action: 'access_denied',
                entity: 'access',
                label: `${request.method} ${request.nextUrl.pathname}`,
                changes: { query: request.nextUrl.search || null },
            }),
        }).catch(() => undefined)
    );
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
    const pathname = request.nextUrl.pathname;
    const method = request.method.toUpperCase();

    // Allow trusted external systems to read inventory without an admin session.
    // The key is server-side only and must be sent as `x-api-key`.
    if (
        pathname === '/api/stock/inventory' &&
        method === 'GET' &&
        process.env.STOCK_API_KEY &&
        request.headers.get('x-api-key') === process.env.STOCK_API_KEY
    ) {
        return NextResponse.next();
    }


    // Already-signed-in back-office users have no reason to see the login form.
    if (pathname === ADMIN_LOGIN_PATH) {
        const response = NextResponse.next();
        const user = await getRequestUser(request, response);
        if (getAdminRole(user)) {
            return NextResponse.redirect(new URL('/admin/dashboard', request.url));
        }
        return response;
    }

    const needed = requirementFor(request);
    if (needed) {
        const pending = NextResponse.next();
        const user = await getRequestUser(request, pending);
        const role = getAdminRole(user);
        if (!role) {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const loginUrl = new URL(ADMIN_LOGIN_PATH, request.url);
            loginUrl.searchParams.set('next', pathname);
            return NextResponse.redirect(loginUrl);
        }
        const permissions = getPermissions(user);
        if (!allows(needed, role, permissions)) {
            if (user) logRefusal(request, event, user, role);
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ success: false, error: "You don't have permission to do this." }, { status: 403 });
            }
            return NextResponse.redirect(new URL('/admin/dashboard', request.url));
        }

        // Verified identity for route handlers (overwrites anything the client sent).
        const headers = new Headers(request.headers);
        headers.set(ADMIN_HEADERS.role, role);
        headers.set(ADMIN_HEADERS.userId, user?.id ?? '');
        headers.set(ADMIN_HEADERS.email, user?.email ?? '');
        headers.set(ADMIN_HEADERS.permissions, permissions.join(','));
        const response = NextResponse.next({ request: { headers } });
        pending.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
        return response;
    }

    if (
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/favicon.ico') ||
        pathname.includes('.')
    ) {
        return NextResponse.next({ request: { headers: withoutAdminHeaders(request) } });
    }

    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        return NextResponse.next({ request: { headers: withoutAdminHeaders(request) } });
    }

    if (pathname === '/api-docs' || pathname.startsWith('/api-docs/') || pathname.startsWith('/api/')) {
        return NextResponse.next({ request: { headers: withoutAdminHeaders(request) } });
    }

    const segments = pathname.split('/');
    if (segments.length >= 3 && segments[2] === 'api-docs') {
        const locale = segments[1];
        if (isValidLocale(locale)) {
            return NextResponse.redirect(new URL('/api-docs', request.url));
        }
    }

    const pathnameIsMissingLocale = supportedLanguages.every(
        (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
    );

    if (pathnameIsMissingLocale) {
        const acceptLanguage = request.headers.get('accept-language');
        const locale = detectLanguageFromHeader(acceptLanguage);
        return NextResponse.redirect(new URL(`/${locale}${pathname}`, request.url));
    }

    const locale = segments[1];
    if (locale && !isValidLocale(locale)) {
        return NextResponse.redirect(new URL(`/${defaultLanguage}${pathname}`, request.url));
    }

    // Lets the root layout set <html lang> for the requested locale.
    const requestHeaders = withoutAdminHeaders(request);
    requestHeaders.set('x-locale', locale);
    return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
    // /monitoring is the Sentry tunnel (next.config.ts): no locale prefix, no admin gate.
    matcher: ['/((?!_next|favicon.ico|monitoring).*)'],
};
