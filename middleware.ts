import { NextRequest, NextResponse } from 'next/server';
import { supportedLanguages, defaultLanguage, detectLanguageFromHeader, isValidLocale } from './lib/language-utils';

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // Skip middleware for static files
    if (
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/favicon.ico') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // Allow /admin routes to bypass locale redirection
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        return NextResponse.next();
    }

    // Allow /api-docs and /api routes to bypass locale redirection
    if (pathname === '/api-docs' || pathname.startsWith('/api-docs/') || pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    // Redirect /[locale]/api-docs to /api-docs (strip locale)
    const segments = pathname.split('/');
    if (segments.length >= 3 && segments[2] === 'api-docs') {
        const locale = segments[1];
        if (isValidLocale(locale)) {
            return NextResponse.redirect(new URL('/api-docs', request.url));
        }
    }

    // Check if pathname already has a language prefix
    const pathnameIsMissingLocale = supportedLanguages.every(
        (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
    );

    // Redirect if there is no locale
    if (pathnameIsMissingLocale) {
        const acceptLanguage = request.headers.get('accept-language');
        const locale = detectLanguageFromHeader(acceptLanguage);

        // Redirect to the localized path
        return NextResponse.redirect(
            new URL(`/${locale}${pathname}`, request.url)
        );
    }

    // Validate the locale in the URL
    const locale = segments[1];

    if (locale && !isValidLocale(locale)) {
        // Invalid locale, redirect to default
        return NextResponse.redirect(
            new URL(`/${defaultLanguage}${pathname}`, request.url)
        );
    }
}

export const config = {
    matcher: [
        // Include API routes and admin routes for session refresh
        '/((?!_next|favicon.ico).*)',
    ],
};
