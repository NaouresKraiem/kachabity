import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') || '/';

    if (code) {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        try {
            // Exchange the code for a session
            const { error } = await supabase.auth.exchangeCodeForSession(code);

            if (error) {
                console.error('Error exchanging code for session:', error);
                return NextResponse.redirect(new URL('/auth?error=auth_failed', requestUrl.origin));
            }

            // Successful authentication - redirect to the intended destination
            return NextResponse.redirect(new URL(next, requestUrl.origin));
        } catch (err) {
            console.error('Unexpected error during auth callback:', err);
            return NextResponse.redirect(new URL('/auth?error=unexpected_error', requestUrl.origin));
        }
    }

    // No code present, redirect to home
    return NextResponse.redirect(new URL('/', requestUrl.origin));
}

