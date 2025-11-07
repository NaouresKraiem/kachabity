import { NextRequest, NextResponse } from 'next/server';
import { supportedLanguages, defaultLanguage, detectLanguageFromHeader, isValidLocale } from './lib/language-utils';

export function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // Skip middleware for static files and API routes
    if (
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/api/') ||
        pathname.startsWith('/favicon.ico') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
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
    const segments = pathname.split('/');
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
        // Skip all internal paths (_next)
        '/((?!_next|api|favicon.ico).*)',
    ],
};
