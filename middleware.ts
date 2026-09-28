import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { supportedLanguages, defaultLanguage, detectLanguageFromHeader, isValidLocale } from './lib/language-utils';
import { isAdminUser } from './lib/admin-auth';
import { supabaseUrl, supabasePublishableKey } from './lib/supabase-env';

const ADMIN_LOGIN_PATH = '/admin/login';

const ADMIN_MUTATION_PATHS = new Set([
    '/api/categories',
    '/api/colors',
    '/api/sizes',
    '/api/promotions',
    '/api/sale-banners',
    '/api/reels',
    '/api/variants',
    '/api/products',
    '/api/product-images',
    '/api/upload/image',
    '/api/cart/send-recovery-emails',
    '/api/cart/analytics',
]);

function isProtectedApiRequest(request: NextRequest): boolean {
    const { pathname, searchParams } = request.nextUrl;
    const method = request.method.toUpperCase();

    if (pathname === '/api/cart/analytics') return true;
    if (pathname === '/api/products' && searchParams.get('admin') === 'true' && method === 'GET') {
        return true;
    }
    if (pathname === '/api/orders' && method !== 'POST') {
        return true;
    }
    return ADMIN_MUTATION_PATHS.has(pathname) && method !== 'GET';
}

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
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims) return null;
    return {
        email: typeof claims.email === 'string' ? claims.email : null,
        app_metadata: (claims.app_metadata ?? {}) as Record<string, unknown>,
    };
}

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');

    // Already-signed-in admins have no reason to see the login form.
    if (pathname === ADMIN_LOGIN_PATH) {
        const response = NextResponse.next();
        const user = await getRequestUser(request, response);
        if (isAdminUser(user)) {
            return NextResponse.redirect(new URL('/admin/dashboard', request.url));
        }
        return response;
    }

    if ((isAdminPage && pathname !== ADMIN_LOGIN_PATH) || isProtectedApiRequest(request)) {
        const response = NextResponse.next();
        const user = await getRequestUser(request, response);
        if (!isAdminUser(user)) {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const loginUrl = new URL(ADMIN_LOGIN_PATH, request.url);
            loginUrl.searchParams.set('next', pathname);
            return NextResponse.redirect(loginUrl);
        }
        return response;
    }

    if (
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/favicon.ico') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        return NextResponse.next();
    }

    if (pathname === '/api-docs' || pathname.startsWith('/api-docs/') || pathname.startsWith('/api/')) {
        return NextResponse.next();
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
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-locale', locale);
    return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
    matcher: ['/((?!_next|favicon.ico).*)'],
};
