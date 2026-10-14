import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { getAdminActor } from '@/lib/admin-auth';
import { reportError } from '@/lib/report-error';
import { invalidateCatalog } from '@/lib/catalog-cache';
import { ColissimoError, colissimoConfigured, createParcel, trackParcel, type ParcelRequest } from '@/lib/colissimo';
import { COLISSIMO_GOVERNORATES, FINAL_STATUSES, parcelFromOrder } from '@/lib/colissimo-data';
import { buildManualOrderLines, ManualLineError, type ManualLineInput } from '@/lib/manual-order-lines';
import { generateOrderNumber } from '@/lib/order-number';

// Parcels sent to Colissimo (Admin → Delivery, and the order page).
// GET lists them; POST sends an order, adds an existing parcel by barcode or refreshes statuses;
// DELETE removes parcels from this list (Colissimo's API can't cancel a parcel).

const DELIVERY_SELECT = '*, order:orders(id, order_number, customer_first_name, customer_last_name, status, total)';

const parcelSchema = z.object({
    nom: z.string().trim().min(1).max(100),
    gouvernerat: z.enum(COLISSIMO_GOVERNORATES as [string, ...string[]]),
    ville: z.string().trim().min(1).max(100),
    adresse: z.string().trim().min(1).max(250),
    tel: z.string().trim().regex(/^\d{8}$/, 'Phone must be exactly 8 digits'),
    tel2: z.string().trim().regex(/^(\d{8})?$/, 'Second phone must be 8 digits').optional(),
    designation: z.string().trim().min(1).max(250),
    nb_article: z.number().int().min(1).max(999),
    prix: z.number().min(0).max(100000),
    msg: z.string().trim().max(250).optional(),
    echange: z.enum(['oui', 'non']),
    article: z.string().trim().max(250).optional(),
    nb_echange: z.number().int().min(0).max(999).optional(),
    ouvrir: z.union([z.literal(0), z.literal(1)]),
    fragile: z.union([z.literal(0), z.literal(1)]),
    type_colis: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

const bodySchema = z.discriminatedUnion('action', [
    // order_id is optional: a parcel can also be entered by hand. With `items` (and no order_id),
    // an order is created for those products and validated, so they leave the stock.
    z.object({
        action: z.literal('create'),
        order_id: z.guid().optional(),
        parcel: parcelSchema,
        items: z.array(z.object({ product_id: z.guid(), variant_id: z.guid().nullish(), quantity: z.number().int().min(1).max(999) })).max(50).optional(),
    }),
    // Validating an order: its parcel is built from the order and sent, then the order is validated.
    z.object({ action: z.literal('validate'), order_id: z.guid() }),
    // Prices for products picked in "New parcel" (catalog prices and discounts), without saving.
    z.object({ action: z.literal('quote'), items: z.array(z.object({ product_id: z.guid(), variant_id: z.guid().nullish(), quantity: z.number().int().min(1).max(999) })).min(1).max(50) }),
    // Look up one parcel's status at Colissimo without saving anything.
    z.object({ action: z.literal('track'), barcode: z.string().trim().regex(/^\d{6,20}$/, 'Barcode must be digits') }),
    z.object({ action: z.literal('import'), barcode: z.string().trim().regex(/^\d{6,20}$/, 'Barcode must be digits'), order_id: z.guid().optional() }),
    z.object({ action: z.literal('refresh'), ids: z.array(z.guid()).max(200).optional() }),
]);

function dbErrorResponse(error: { message?: string; code?: string }) {
    const message = error.message ?? '';
    if (message.includes('order_not_found')) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    if (message.includes('order_cancelled')) return NextResponse.json({ success: false, error: 'This order is cancelled', code: 'ORDER_CANCELLED' }, { status: 409 });
    if (message.includes('delivery_exists') || error.code === '23505') {
        return NextResponse.json({ success: false, error: 'This order or barcode already has a parcel', code: 'DELIVERY_EXISTS' }, { status: 409 });
    }
    return null;
}

export async function GET(request: NextRequest) {
    try {
        const orderId = request.nextUrl.searchParams.get('order_id');
        let query = supabase.from('deliveries').select(DELIVERY_SELECT).is('deleted_at', null).order('created_at', { ascending: false }).limit(1000);
        if (orderId) query = query.eq('order_id', orderId);
        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ success: true, data: { rows: data ?? [], configured: colissimoConfigured() } });
    } catch (error) {
        console.error('Error loading deliveries:', error);
        reportError(error, 'admin-delivery', { action: 'list' });
        return NextResponse.json({ success: false, error: 'Unable to load deliveries' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    const body = parsed.data;
    const actor = getAdminActor(request.headers);
    try {
        if (body.action === 'create') {
            if (!body.order_id && body.items?.length) return await sendNewOrder(body.parcel as ParcelRequest, body.items, actor);
            return await sendParcel(body.order_id ?? null, body.parcel as ParcelRequest, actor);
        }
        if (body.action === 'validate') return await validateOrder(body.order_id, actor);
        if (body.action === 'quote') return NextResponse.json({ success: true, data: { lines: await buildManualOrderLines(body.items) } });
        if (body.action === 'track') return await lookUpParcel(body.barcode);
        if (body.action === 'import') return await importParcel(body.barcode, body.order_id ?? null, actor);
        return await refreshStatuses(body.ids, actor);
    } catch (error) {
        if (error instanceof ManualLineError) {
            return NextResponse.json({ success: false, error: error.message, code: 'INVALID_ITEMS' }, { status: 422 });
        }
        if (error instanceof ColissimoError) {
            return NextResponse.json({ success: false, error: error.message, code: 'COLISSIMO' }, { status: 502 });
        }
        console.error('Delivery error:', error);
        reportError(error, 'admin-delivery', { action: body.action });
        return NextResponse.json({ success: false, error: 'Delivery request failed' }, { status: 500 });
    }
}

type Actor = ReturnType<typeof getAdminActor>;

// Reserve the parcel row (for an order: its single live parcel), create the parcel at Colissimo,
// then record its barcode and mark the order shipped. If Colissimo refuses, the row is released.
async function sendParcel(orderId: string | null, parcel: ParcelRequest, actor: Actor) {
    if (!colissimoConfigured().add) {
        return NextResponse.json({ success: false, error: 'Colissimo is not set up: add COLISSIMO_ADD_TOKEN to the server environment', code: 'NOT_CONFIGURED' }, { status: 503 });
    }
    const { data: reserved, error: reserveError } = orderId
        ? await supabase.rpc('begin_delivery', { p_order_id: orderId, p_request: parcel, p_actor: actor.userId, p_actor_email: actor.email })
        : await supabase
            .from('deliveries')
            .insert({
                status: 'sending', recipient_name: parcel.nom, phone: parcel.tel, governorate: parcel.gouvernerat, city: parcel.ville,
                address: parcel.adresse, cod_amount: parcel.prix, items_count: parcel.nb_article, designation: parcel.designation,
                request: parcel, created_by: actor.userId, created_by_email: actor.email,
            })
            .select('id')
            .single();
    if (reserveError) return dbErrorResponse(reserveError) ?? Promise.reject(reserveError);

    let created: Awaited<ReturnType<typeof createParcel>>;
    try {
        created = await createParcel(parcel);
    } catch (error) {
        await supabase.rpc('fail_delivery', { p_id: reserved.id, p_error: (error as Error).message });
        throw error;
    }

    const { data: result, error } = await supabase.rpc('complete_delivery', {
        p_id: reserved.id, p_barcode: created.barcode, p_label_url: created.labelUrl, p_label_zebra_url: created.labelZebraUrl,
        p_actor: actor.userId, p_actor_email: actor.email,
    });
    if (error) {
        // The parcel exists at Colissimo: release the row and give the barcode back so it can be
        // added with "Add by barcode".
        reportError(error, 'admin-delivery', { action: 'complete' });
        await supabase.rpc('fail_delivery', { p_id: reserved.id, p_error: `Created as ${created.barcode}, not saved: ${error.message}` });
        return NextResponse.json({
            success: false,
            error: `Colissimo created parcel ${created.barcode}, but saving it failed. Add it with "Add by barcode".`,
            code: 'SAVE_FAILED',
            barcode: created.barcode,
        }, { status: 500 });
    }
    invalidateCatalog(); // validating the order took its items out of stock
    return NextResponse.json({ success: true, data: { delivery: result.delivery, order: result.order, warning: result.warning } });
}

// "New parcel" with products: price the lines from the catalog, create the parcel at Colissimo,
// then save the order, its lines and the parcel and validate the order (stock) in one transaction
// (create_order_with_delivery). If Colissimo refuses, nothing is created. A new order can't be
// sent twice, so no reservation is needed (the form blocks double submits).
async function sendNewOrder(parcel: ParcelRequest, items: ManualLineInput[], actor: Actor) {
    if (!colissimoConfigured().add) {
        return NextResponse.json({ success: false, error: 'Colissimo is not set up: add COLISSIMO_ADD_TOKEN to the server environment', code: 'NOT_CONFIGURED' }, { status: 503 });
    }
    const lines = await buildManualOrderLines(items); // create_order ignores the extra `stock` field
    const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
    const [firstName, ...rest] = parcel.nom.trim().split(/\s+/);

    const created = await createParcel(parcel);
    const { data: result, error } = await supabase.rpc('create_order_with_delivery', {
        p_order: {
            order_number: generateOrderNumber(),
            customer_first_name: firstName,
            customer_last_name: rest.join(' '),
            customer_phone: parcel.tel,
            shipping_address: parcel.adresse,
            shipping_city: parcel.ville,
            shipping_state: parcel.gouvernerat,
            shipping_country: 'Tunisia',
            // The cash to collect is what the customer pays; above the products, it's the delivery fee.
            subtotal,
            shipping_cost: Math.max(0, parcel.prix - subtotal),
            total: parcel.prix,
            order_notes: parcel.msg || null,
        },
        p_items: lines,
        p_delivery: { barcode: created.barcode, label_url: created.labelUrl, label_zebra_url: created.labelZebraUrl, request: parcel },
        p_actor: actor.userId,
        p_actor_email: actor.email,
    });
    if (error) {
        reportError(error, 'admin-delivery', { action: 'create-order' });
        return NextResponse.json({
            success: false,
            error: `Colissimo created parcel ${created.barcode}, but saving the order failed. Add it with "Add by barcode".`,
            code: 'SAVE_FAILED',
            barcode: created.barcode,
        }, { status: 500 });
    }
    invalidateCatalog(); // the products left the stock
    return NextResponse.json({ success: true, data: { delivery: result.delivery, order: result.order, warning: null } });
}

// The Validate button: create the order's Colissimo parcel from its details, then validate it
// (complete_delivery). If a detail Colissimo needs is missing or invalid, nothing is sent and the
// admin completes it in the send form (NEEDS_DETAILS). Without Colissimo tokens, the order is
// validated without a parcel.
async function validateOrder(orderId: string, actor: Actor) {
    const { data: order, error } = await supabase
        .from('orders')
        .select('id, status, customer_first_name, customer_last_name, customer_phone, shipping_address, shipping_city, shipping_state, total, payment_status, order_notes, items:order_items(product_name, variant_label, quantity)')
        .eq('id', orderId)
        .is('deleted_at', null)
        .maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    if (order.status !== 'pending') {
        return NextResponse.json({ success: false, error: 'This order is already validated', code: 'ALREADY_VALIDATED' }, { status: 409 });
    }

    if (!colissimoConfigured().add) {
        const { data: updated, error: statusError } = await supabase.rpc('set_order_status', {
            p_order_id: orderId, p_changes: { status: 'processing' }, p_actor: actor.userId, p_actor_email: actor.email,
        });
        if (statusError) throw statusError;
        invalidateCatalog();
        return NextResponse.json({
            success: true,
            data: { delivery: null, order: { status: updated.status, stock_deducted: updated.stock_deducted }, warning: 'Colissimo is not connected: the order was validated without a parcel.' },
        });
    }

    const parcel = parcelSchema.safeParse(parcelFromOrder(order));
    if (!parcel.success) {
        const fields = [...new Set(parcel.error.issues.map((issue) => String(issue.path[0])))];
        return NextResponse.json({
            success: false,
            error: `Delivery details to complete before sending: ${fields.join(', ')}`,
            code: 'NEEDS_DETAILS',
            fields,
        }, { status: 422 });
    }
    return sendParcel(orderId, parcel.data as ParcelRequest, actor);
}

// "Check a parcel": Colissimo's current status for any barcode, plus the parcel in our list if
// there is one. Read-only: the list isn't updated (use "Check" on the row for that).
async function lookUpParcel(barcode: string) {
    if (!colissimoConfigured().tracking) {
        return NextResponse.json({ success: false, error: 'Colissimo tracking is not set up: add COLISSIMO_TRACKING_TOKEN to the server environment', code: 'NOT_CONFIGURED' }, { status: 503 });
    }
    const [tracked, { data: listed, error }] = await Promise.all([
        trackParcel(barcode),
        supabase.from('deliveries').select(DELIVERY_SELECT).eq('barcode', barcode).is('deleted_at', null).maybeSingle(),
    ]);
    if (error) throw error;
    return NextResponse.json({ success: true, data: { barcode, ...tracked, delivery: listed ?? null } });
}

// A parcel created on Colissimo's website: checked with the tracking API, then listed.
async function importParcel(barcode: string, orderId: string | null, actor: Actor) {
    if (!colissimoConfigured().tracking) {
        return NextResponse.json({ success: false, error: 'Colissimo tracking is not set up: add COLISSIMO_TRACKING_TOKEN to the server environment', code: 'NOT_CONFIGURED' }, { status: 503 });
    }
    const tracked = await trackParcel(barcode);
    const { data, error } = await supabase
        .from('deliveries')
        .insert({
            barcode, order_id: orderId, status: tracked.status, status_reason: tracked.reason || null, status_changed_at: new Date().toISOString(),
            created_by: actor.userId, created_by_email: actor.email,
        })
        .select(DELIVERY_SELECT)
        .single();
    if (error) return dbErrorResponse(error) ?? Promise.reject(error);
    return NextResponse.json({ success: true, data: { delivery: data } });
}

// Asks Colissimo for the status of the given parcels (default: every parcel that can still change).
async function refreshStatuses(ids: string[] | undefined, actor: Actor) {
    if (!colissimoConfigured().tracking) {
        return NextResponse.json({ success: false, error: 'Colissimo tracking is not set up: add COLISSIMO_TRACKING_TOKEN to the server environment', code: 'NOT_CONFIGURED' }, { status: 503 });
    }
    let query = supabase.from('deliveries').select('id, barcode, status').is('deleted_at', null).not('barcode', 'is', null);
    query = ids?.length ? query.in('id', ids) : query.not('status', 'in', `(${FINAL_STATUSES.map((s) => `"${s}"`).join(',')})`);
    const { data: parcels, error } = await query.limit(200);
    if (error) throw error;

    let changed = 0;
    const failures: { barcode: string; error: string }[] = [];
    // A few at a time: Colissimo answers one parcel per request.
    const queue = [...(parcels ?? [])];
    await Promise.all(Array.from({ length: Math.min(5, queue.length) }, async () => {
        for (let parcel = queue.shift(); parcel; parcel = queue.shift()) {
            try {
                const tracked = await trackParcel(parcel.barcode as string);
                const { data: updated, error: saveError } = await supabase.rpc('record_delivery_status', {
                    p_id: parcel.id, p_status: tracked.status, p_reason: tracked.reason, p_actor: actor.userId, p_actor_email: actor.email,
                });
                if (saveError) throw saveError;
                if (updated) changed += 1;
            } catch (err) {
                failures.push({ barcode: parcel.barcode as string, error: (err as Error).message });
            }
        }
    }));
    if (changed > 0) invalidateCatalog();
    return NextResponse.json({ success: true, data: { checked: parcels?.length ?? 0, changed, failures } });
}

// DELETE ?ids=a,b — removes parcels from this list only (soft delete); the order can then be sent again.
export async function DELETE(request: NextRequest) {
    try {
        const ids = (request.nextUrl.searchParams.get('ids') ?? '').split(',').map((id) => id.trim()).filter(Boolean);
        if (ids.length === 0) return NextResponse.json({ success: false, error: 'No parcel selected' }, { status: 400 });
        const { error } = await supabase.from('deliveries').update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in('id', ids).is('deleted_at', null);
        if (error) throw error;
        return NextResponse.json({ success: true, data: { deleted: ids.length } });
    } catch (error) {
        console.error('Error removing deliveries:', error);
        reportError(error, 'admin-delivery', { action: 'delete' });
        return NextResponse.json({ success: false, error: 'Unable to remove parcels' }, { status: 500 });
    }
}
