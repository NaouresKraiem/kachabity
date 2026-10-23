import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase-admin';
import { reportError } from '@/lib/report-error';
import { parseWebhook, validSignature, type IncomingMessage } from '@/lib/erp/meta';

export const dynamic = 'force-dynamic';

/**
 * Meta webhook (Messenger, Instagram Direct, WhatsApp Cloud API). Public: Meta calls it, and
 * every POST must be signed with META_APP_SECRET. Incoming messages are stored as conversations
 * on the customer they come from (matched by phone on WhatsApp, by platform id otherwise; a new
 * contact gets a customer record), and the customers team is notified.
 */

// Subscription check from Meta's dashboard.
export async function GET(request: NextRequest) {
    const sp = request.nextUrl.searchParams;
    if (sp.get('hub.mode') === 'subscribe' && process.env.META_VERIFY_TOKEN && sp.get('hub.verify_token') === process.env.META_VERIFY_TOKEN) {
        return new NextResponse(sp.get('hub.challenge') ?? '', { status: 200 });
    }
    return new NextResponse('Forbidden', { status: 403 });
}

async function customerFor(message: IncomingMessage): Promise<string> {
    const key = message.channel === 'facebook' ? 'messenger' : message.channel;
    const { data: byId } = await supabase.from('customers').select('id')
        .contains('external_ids', { [key]: message.senderId }).is('deleted_at', null).limit(1).maybeSingle();
    if (byId) return byId.id;

    let phone: string | null = null;
    if (message.phone) {
        phone = (await supabase.rpc('normalize_phone', { p_phone: message.phone })).data as string | null;
        if (phone) {
            const { data: byPhone } = await supabase.from('customers').select('id, external_ids').eq('phone', phone).is('deleted_at', null).maybeSingle();
            if (byPhone) {
                await supabase.from('customers').update({ external_ids: { ...(byPhone.external_ids as object), [key]: message.senderId } }).eq('id', byPhone.id);
                return byPhone.id;
            }
        }
    }
    const { data: created, error } = await supabase.from('customers').insert({
        phone,
        full_name: message.senderName ?? '',
        channel: message.channel,
        stage: 'new',
        external_ids: { [key]: message.senderId },
    }).select('id').single();
    if (error) throw error;
    return created.id;
}

export async function POST(request: NextRequest) {
    const raw = await request.text();
    if (!validSignature(raw, request.headers.get('x-hub-signature-256'))) {
        return new NextResponse('Invalid signature', { status: 401 });
    }
    try {
        const messages = parseWebhook(JSON.parse(raw));
        for (const message of messages) {
            const customerId = await customerFor(message);
            const { error } = await supabase.from('customer_interactions').upsert({
                customer_id: customerId,
                channel: message.channel,
                direction: 'in',
                body: message.text.slice(0, 5000),
                external_id: message.externalId,
                sender_name: message.senderName,
                created_at: message.sentAt.toISOString(),
            }, { onConflict: 'channel,external_id', ignoreDuplicates: true });
            if (error) throw error;
            await supabase.from('customers').update({ updated_at: new Date().toISOString() }).eq('id', customerId);
        }
    } catch (error) {
        // Answer 200 anyway: Meta retries failed deliveries for hours and then disables the webhook.
        console.error('Meta webhook failed:', error);
        reportError(error, 'meta-webhook');
    }
    return NextResponse.json({ received: true });
}
