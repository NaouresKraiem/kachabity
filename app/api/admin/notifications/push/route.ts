import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase-admin';
import { getAdminActor } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// Desktop notifications (Web Push) for the signed-in back-office user. The browser
// subscribes with the public key from GET, then registers the subscription with POST.
// Delivery is done by the send-push Edge Function.

const LOCALES = ['en', 'fr', 'ar'];

// GET returns { publicKey }.
export async function GET() {
    const { data, error } = await supabase.from('site_settings').select('setting_value').eq('setting_key', 'vapid_public_key').maybeSingle();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data: { publicKey: data?.setting_value ?? null } });
}

// POST { subscription: { endpoint, keys: { p256dh, auth } }, locale } registers this browser.
export async function POST(request: NextRequest) {
    try {
        const { userId } = getAdminActor(request.headers);
        if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        const { subscription, locale } = await request.json();
        const endpoint = subscription?.endpoint;
        const p256dh = subscription?.keys?.p256dh;
        const auth = subscription?.keys?.auth;
        if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || typeof p256dh !== 'string' || typeof auth !== 'string') {
            return NextResponse.json({ success: false, error: 'Invalid push subscription' }, { status: 400 });
        }
        const { error } = await supabase.from('push_subscriptions').upsert({
            user_id: userId,
            endpoint,
            p256dh,
            auth,
            locale: LOCALES.includes(locale) ? locale : 'en',
            user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
            last_error: null,
            deleted_at: null,
        }, { onConflict: 'endpoint' });
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving push subscription:', error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}

// DELETE { endpoint } stops desktop notifications for this browser (soft delete).
export async function DELETE(request: NextRequest) {
    try {
        const { userId } = getAdminActor(request.headers);
        if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        const { endpoint } = await request.json();
        if (typeof endpoint !== 'string') return NextResponse.json({ success: false, error: 'endpoint is required' }, { status: 400 });
        const { error } = await supabase
            .from('push_subscriptions')
            .update({ deleted_at: new Date().toISOString() })
            .eq('endpoint', endpoint)
            .eq('user_id', userId)
            .is('deleted_at', null);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing push subscription:', error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
