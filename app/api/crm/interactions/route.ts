import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, ok, params, readBody, route, zId } from '@/lib/erp/api';
import { metaConfigured, sendMetaText, type MetaChannel } from '@/lib/erp/meta';

export const dynamic = 'force-dynamic';

/**
 * Conversations with customers: messages received through Meta's webhook, replies sent from the
 * admin, and calls/notes typed by agents (the CRM works by hand when no channel is connected).
 */

// GET ?customer_id= — one customer's conversation (oldest first).
// GET ?inbox=1 — latest message per customer, unread first; ?unread=1 only unread.
export const GET = route('crm-interactions', async (request) => {
    const q = params(request);
    const customerId = q.get('customer_id');
    if (customerId) {
        return ok(must(await supabase.from('customer_interactions').select('*').eq('customer_id', customerId)
            .is('deleted_at', null).order('created_at').limit(500)));
    }
    let query = supabase.from('customer_interactions')
        .select('id, customer_id, channel, direction, body, created_at, read_at, sender_name, customer:customers(full_name, phone, stage, assigned_to_email)')
        .is('deleted_at', null).in('channel', ['facebook', 'instagram', 'whatsapp', 'tiktok'])
        .order('created_at', { ascending: false }).limit(1000);
    if (q.bool('unread')) query = query.eq('direction', 'in').is('read_at', null);
    const rows = must(await query) as unknown as { customer_id: string; direction: string; read_at: string | null }[];
    const latest = new Map<string, (typeof rows)[number] & { unread: number }>();
    for (const row of rows) {
        const unread = row.direction === 'in' && !row.read_at ? 1 : 0;
        const seen = latest.get(row.customer_id);
        if (seen) seen.unread += unread;
        else latest.set(row.customer_id, { ...row, unread });
    }
    const threads = [...latest.values()].sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0));
    return ok({ threads, connected: metaConfigured() });
});

const createSchema = z.object({
    customer_id: zId,
    channel: z.enum(['website', 'facebook', 'instagram', 'tiktok', 'whatsapp', 'phone', 'store', 'email', 'other']),
    // in: what the customer said; out: what we said; note: internal.
    direction: z.enum(['in', 'out', 'note']),
    body: z.string().trim().min(1).max(5000),
    order_id: zId.nullish(),
    // Actually send it on the channel (Messenger, Instagram, WhatsApp) instead of only logging it.
    send: z.boolean().default(false),
});

export const POST = route('crm-interactions', async (request, actor) => {
    const body = await readBody(request, createSchema);
    let externalId: string | null = null;
    if (body.send) {
        if (body.direction !== 'out' || !['facebook', 'instagram', 'whatsapp'].includes(body.channel)) {
            throw new HttpError('Only replies on Messenger, Instagram or WhatsApp can be sent.');
        }
        const channel = body.channel as MetaChannel;
        if (!metaConfigured()[channel]) throw new HttpError(`${channel} is not connected yet. Log the message instead.`, 503, 'NOT_CONFIGURED');
        const customer = must(await supabase.from('customers').select('phone, external_ids').eq('id', body.customer_id).maybeSingle());
        const ids = (customer?.external_ids ?? {}) as Record<string, string>;
        const recipient = channel === 'whatsapp' ? ids.whatsapp ?? (customer?.phone ? `216${customer.phone}` : null) : ids[channel === 'facebook' ? 'messenger' : 'instagram'];
        if (!recipient) throw new HttpError('This customer has never written to us on this channel.', 409);
        try {
            externalId = await sendMetaText(channel, recipient, body.body);
        } catch (error) {
            throw new HttpError(`Not sent: ${(error as Error).message}`, 502, 'META');
        }
    }
    const data = must(await supabase.from('customer_interactions').insert({
        customer_id: body.customer_id,
        channel: body.channel,
        direction: body.direction,
        body: body.body,
        order_id: body.order_id ?? null,
        external_id: externalId,
        read_at: new Date().toISOString(),
        created_by: actor.userId,
        created_by_email: actor.email,
    }).select().single());
    await supabase.from('customers').update({ updated_at: new Date().toISOString() }).eq('id', body.customer_id);
    return ok(data, 201);
});

// PUT { customer_id } — marks a customer's messages read.
export const PUT = route('crm-interactions', async (request) => {
    const body = await readBody(request, z.object({ customer_id: zId }));
    must(await supabase.from('customer_interactions').update({ read_at: new Date().toISOString() })
        .eq('customer_id', body.customer_id).eq('direction', 'in').is('read_at', null));
    return ok({ customer_id: body.customer_id });
});

export const DELETE = route('crm-interactions', async (request) => {
    const id = params(request).get('id');
    if (!id) throw new HttpError('Missing id');
    must(await supabase.from('customer_interactions').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('direction', 'note'));
    return ok({ id });
});
