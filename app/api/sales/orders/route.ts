import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, isManager, must, type Row, ok, params, readBody, route, zId, zMoney } from '@/lib/erp/api';
import { CHANNELS, type Channel } from '@/lib/erp/constants';
import { memberEmail } from '@/lib/erp/team';
import { buildManualOrderLines, ManualLineError } from '@/lib/manual-order-lines';
import { calculateShipping } from '@/lib/shipping';
import { generateOrderNumber } from '@/lib/order-number';
import { COLISSIMO_GOVERNORATES } from '@/lib/colissimo-data';
import { invalidateCatalog } from '@/lib/catalog-cache';

export const dynamic = 'force-dynamic';

/**
 * Orders typed in by agents (Facebook, Instagram, TikTok, WhatsApp, phone) and the order
 * pipeline actions: assigning orders to agents, confirming them with the customer, and checking
 * a phone number for orders already in progress (duplicates).
 */

// GET ?phone=&exclude= — the customer with this phone and their orders still in progress.
export const GET = route('sales-orders', async (request) => {
    const q = params(request);
    const phone = q.get('phone');
    if (!phone) throw new HttpError('Phone is required');
    const { data: settings } = await supabase.from('erp_settings').select('value').eq('key', 'sales').maybeSingle();
    const days = Number((settings?.value as { duplicate_window_days?: number } | null)?.duplicate_window_days ?? 30);
    const [duplicates, normalized] = await Promise.all([
        supabase.rpc('find_order_duplicates', { p_phone: phone, p_exclude: q.get('exclude'), p_days: days }),
        supabase.rpc('normalize_phone', { p_phone: phone }),
    ]);
    const customer = normalized.data
        ? must(await supabase.from('customers').select('id, full_name, phone, email, governorate, city, address, stage, tags, notes')
              .eq('phone', normalized.data).is('deleted_at', null).maybeSingle())
        : null;
    return ok({ customer, open_orders: must(duplicates) ?? [] });
});

const itemSchema = z.object({ product_id: zId, variant_id: zId.nullish(), quantity: z.number().int().min(1).max(999) });

const createSchema = z.object({
    customer: z.object({
        phone: z.string().trim().regex(/^[24579]\d{7}$/, 'Invalid Tunisian phone number'),
        first_name: z.string().trim().min(1).max(100),
        last_name: z.string().trim().max(100).default(''),
        email: z.string().trim().email().optional().or(z.literal('')),
        governorate: z.enum(COLISSIMO_GOVERNORATES as [string, ...string[]]),
        city: z.string().trim().min(1).max(100),
        address: z.string().trim().min(1).max(250),
    }),
    items: z.array(itemSchema).min(1).max(50),
    channel: z.enum(CHANNELS).refine((c) => c !== 'store' && c !== 'website', 'Choose where the order came from'),
    campaign_id: zId.nullish(),
    // Delivery fee charged; omitted: the shop's usual fee (free above the threshold).
    shipping_cost: zMoney.optional(),
    discount_amount: zMoney.default(0),
    notes: z.string().trim().max(2000).optional(),
    assigned_to: zId.nullish(),
    // The customer already agreed (the agent confirmed while taking the order).
    confirmed: z.boolean().default(false),
});

// POST — create an order by hand. Prices come from the catalog; the agent may give a discount
// up to the till's limit (owners and admins: any).
export const POST = route('sales-orders', async (request, actor) => {
    const body = await readBody(request, createSchema);
    let lines;
    try {
        lines = await buildManualOrderLines(body.items);
    } catch (error) {
        if (error instanceof ManualLineError) throw new HttpError(error.message, 422, 'INVALID_ITEMS');
        throw error;
    }
    const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
    if (body.discount_amount > subtotal) throw new HttpError('The discount is larger than the products total.');
    if (body.discount_amount > 0 && !isManager(actor)) {
        const { data: pos } = await supabase.from('erp_settings').select('value').eq('key', 'pos').maybeSingle();
        const maxPercent = Number((pos?.value as { max_discount_percent?: number } | null)?.max_discount_percent ?? 10);
        if (body.discount_amount > (subtotal * maxPercent) / 100 + 0.0005) {
            throw new HttpError(`Discounts above ${maxPercent}% need an owner or admin.`, 403, 'DISCOUNT_LIMIT');
        }
    }
    const shipping = body.shipping_cost ?? (await calculateShipping('TN', subtotal - body.discount_amount)).cost;
    const total = Math.max(0, subtotal - body.discount_amount) + shipping;

    const assignee = body.assigned_to === undefined ? actor.userId : body.assigned_to;
    const assigneeEmail = assignee ? (assignee === actor.userId ? actor.email : await memberEmail(assignee)) : null;
    if (assignee && !assigneeEmail) throw new HttpError('This agent is not on the team.');

    const created = must(await supabase.rpc('create_order', {
        p_order: {
            order_number: generateOrderNumber(),
            customer_email: body.customer.email || null,
            customer_first_name: body.customer.first_name,
            customer_last_name: body.customer.last_name,
            customer_phone: body.customer.phone,
            shipping_address: body.customer.address,
            shipping_city: body.customer.city,
            shipping_state: body.customer.governorate,
            shipping_country: 'Tunisia',
            subtotal,
            shipping_cost: shipping,
            total,
            order_notes: body.notes || null,
            channel: body.channel,
            campaign_id: body.campaign_id ?? null,
            assigned_to: assignee,
            assigned_to_email: assigneeEmail,
            created_by: actor.userId,
            created_by_email: actor.email,
            discount_amount: body.discount_amount,
        },
        p_items: lines,
    })) as { order: { id: string; order_number: string } };

    if (body.confirmed) {
        must(await supabase.rpc('set_order_status', {
            p_order_id: created.order.id, p_changes: { status: 'confirmed' }, p_actor: actor.userId, p_actor_email: actor.email,
        }));
    }
    return ok({ id: created.order.id, order_number: created.order.order_number, total }, 201);
});

const patchSchema = z.discriminatedUnion('action', [
    // Assign orders to an agent (null: unassign).
    z.object({ action: z.literal('assign'), ids: z.array(zId).min(1).max(500), user_id: zId.nullable() }),
    // The customer agreed: pending → confirmed.
    z.object({ action: z.literal('confirm'), ids: z.array(zId).min(1).max(500) }),
    // Where the order came from.
    z.object({ action: z.literal('source'), id: zId, channel: z.enum(CHANNELS), campaign_id: zId.nullable() }),
]);

export const PATCH = route('sales-orders', async (request, actor) => {
    const body = await readBody(request, patchSchema);
    if (body.action === 'assign') {
        // Staff can take unassigned orders for themselves; handing orders to others is for managers.
        if (!isManager(actor) && body.user_id !== actor.userId) {
            throw new HttpError('Only owners and admins can assign orders to someone else.', 403);
        }
        const email = body.user_id ? await memberEmail(body.user_id) : null;
        if (body.user_id && !email) throw new HttpError('This agent is not on the team.');
        if (!isManager(actor)) {
            const taken = must(await supabase.from('orders').select('id').in('id', body.ids).not('assigned_to', 'is', null).neq('assigned_to', actor.userId!));
            if (taken.length) throw new HttpError('Some of these orders are already handled by someone else.', 403);
        }
        const changed = must(await supabase.rpc('assign_orders', { p_order_ids: body.ids, p_user: body.user_id, p_user_email: email }));
        return ok({ changed });
    }
    if (body.action === 'confirm') {
        const orders = must<Row[]>(await supabase.from('orders').select('id, status').in('id', body.ids).is('deleted_at', null));
        let confirmed = 0;
        for (const order of orders.filter((o) => o.status === 'pending')) {
            must(await supabase.rpc('set_order_status', { p_order_id: order.id, p_changes: { status: 'confirmed' }, p_actor: actor.userId, p_actor_email: actor.email }));
            confirmed += 1;
        }
        invalidateCatalog();
        return ok({ confirmed });
    }
    const data = must(await supabase.from('orders')
        .update({ channel: body.channel as Channel, campaign_id: body.campaign_id })
        .eq('id', body.id).is('deleted_at', null).select('id, channel, campaign_id').single());
    return ok(data);
});
