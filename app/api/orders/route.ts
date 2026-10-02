import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase-admin';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { priceOrder } from '@/lib/order-pricing';
import { sendOrderConfirmationEmail } from '@/lib/order-confirmation-email';
import type { Order, OrderItem } from '@/lib/orders';
import { getAdminActor } from '@/lib/admin-auth';
import { invalidateCatalog } from '@/lib/catalog-cache';
import { stockErrorMessage } from '@/lib/stock';

const orderItemSchema = z.object({
    id: z.guid(),
    variantId: z.guid().optional().nullable(),
    name: z.string().optional(),
    name_ar: z.string().optional().nullable(),
    name_fr: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    price: z.number().nonnegative(),
    quantity: z.number().int().positive(),
});

const createOrderSchema = z.object({
    customerEmail: z.string().email().optional(),
    customerFirstName: z.string().trim().min(1),
    customerLastName: z.string().trim().min(1),
    customerPhone: z.string().trim().min(1),
    shippingAddress: z.string().optional(),
    shippingCity: z.string().optional(),
    shippingState: z.string().optional(),
    shippingZip: z.string().optional(),
    shippingCountry: z.string().optional(),
    items: z.array(orderItemSchema).min(1),
    subtotal: z.number().nonnegative(),
    shippingCost: z.number().nonnegative(),
    total: z.number().nonnegative(),
    orderNotes: z.string().max(2000).optional(),
});

function generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomBytes(4).toString('hex').toUpperCase();
    return `ORD-${timestamp}-${random}`;
}

// Links the order to the shopper only when their access token checks out.
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const { data } = await supabase.auth.getUser(token);
    return data.user?.id ?? null;
}

// POST - Create an order (public checkout). Orders are inserted here with the
// service-role key because RLS does not let shoppers write orders directly.
export async function POST(request: NextRequest) {
    try {
        const parsed = createOrderSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: 'Invalid order data' },
                { status: 400 }
            );
        }
        const orderData = parsed.data;

        // Never store client-supplied amounts: re-price against the database and
        // reject if the shopper was shown something different.
        const priced = await priceOrder(orderData.items, orderData.shippingCountry, orderData.total);
        if (!priced.ok) {
            return NextResponse.json(
                { success: false, error: 'Order prices are out of date', code: priced.code },
                { status: 409 }
            );
        }
        const { pricing } = priced;
        const userId = await getUserIdFromRequest(request);

        // The order and its lines are written in one transaction (create_order).
        const { data: created, error: createError } = await supabase.rpc('create_order', {
            p_order: {
                order_number: generateOrderNumber(),
                user_id: userId,
                customer_email: orderData.customerEmail || null,
                customer_first_name: orderData.customerFirstName,
                customer_last_name: orderData.customerLastName,
                customer_phone: orderData.customerPhone,
                shipping_address: orderData.shippingAddress || null,
                shipping_city: orderData.shippingCity || null,
                shipping_state: orderData.shippingState || null,
                shipping_zip: orderData.shippingZip || null,
                shipping_country: orderData.shippingCountry || null,
                subtotal: pricing.subtotal,
                shipping_cost: pricing.shippingCost,
                total: pricing.total,
                order_notes: orderData.orderNotes || null,
            },
            p_items: orderData.items.map((item, index) => {
                const product = pricing.products.get(item.id)!;
                const variant = pricing.variants[index];
                return {
                    product_id: item.id,
                    variant_id: variant?.id ?? null,
                    variant_label: variant?.label || null,
                    product_name: product.name,
                    product_name_ar: product.name_ar,
                    product_name_fr: product.name_fr,
                    product_image: product.image,
                    quantity: item.quantity,
                    price: item.price,
                    subtotal: item.price * item.quantity,
                };
            }),
        });
        if (createError) throw createError;
        const { order, items: orderItems } = created as { order: Order; items: OrderItem[] };

        // Sent from stored data only; a failed email never fails the order.
        if (order.customer_email) {
            const emailResult = await sendOrderConfirmationEmail({
                order,
                orderItems: orderItems ?? [],
                customerName: `${order.customer_first_name} ${order.customer_last_name}`,
            });
            if (!emailResult.success) {
                console.error('Order confirmation email failed for', order.order_number);
            }
        }

        return NextResponse.json({ success: true, data: order }, { status: 201 });
    } catch (error) {
        console.error('Error creating order:', error);
        return NextResponse.json(
            { success: false, error: 'Unable to create order' },
            { status: 500 }
        );
    }
}

// GET - Fetch all orders (admin access)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const status = searchParams.get('status');

        // Build query
        // A single order embeds its items, so the detail page needs one round trip.
        let query = supabase
            .from('orders')
            .select(id ? '*, items:order_items(*)' : '*')
            .order('created_at', { ascending: false });

        // Filter by ID if provided
        if (id) {
            query = query.eq('id', id);
        }

        // Filter by status if provided
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        const { data: orders, error } = await query;

        if (error) throw error;

        if (id && orders && orders.length > 0) {
            return NextResponse.json({ success: true, data: orders[0] });
        }

        return NextResponse.json({ success: true, data: orders || [] });
    } catch (error: any) {
        console.error('Error fetching orders:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// Maps database errors from the order functions to API responses.
function orderErrorResponse(error: { message?: string; code?: string }) {
    if (error.message?.includes('order_not_found')) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    if (error.message?.includes('insufficient_stock') || error.message?.includes('no_online_location')) {
        return NextResponse.json({ success: false, error: stockErrorMessage(error), code: 'STOCK' }, { status: 409 });
    }
    return null;
}

// PUT - Update order status, payment status or notes.
// Validated (processing), shipped and delivered orders take their tracked items out of the
// online location; pending and cancelled ones give them back. The status change and the
// stock movement run in one transaction (set_order_status): a shortage changes nothing.
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        if (!body.id) {
            return NextResponse.json({ success: false, error: 'Order ID is required' }, { status: 400 });
        }

        const changes: Record<string, unknown> = {};
        for (const field of ['status', 'payment_status', 'order_notes']) {
            if (body[field] !== undefined) changes[field] = body[field];
        }
        const actor = getAdminActor(request.headers);
        const { data: order, error } = await supabase.rpc('set_order_status', {
            p_order_id: body.id,
            p_changes: changes,
            p_actor: actor.userId,
            p_actor_email: actor.email,
        });
        if (error) {
            const response = orderErrorResponse(error);
            if (response) return response;
            throw error;
        }

        if (changes.status) invalidateCatalog(); // shop availability may have changed
        return NextResponse.json({ success: true, data: order });
    } catch (error: any) {
        console.error('Error updating order:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE ?id= or ?ids=a,b - Delete orders after returning the stock they took.
// Several orders are deleted together or not at all (delete_orders).
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const ids = (searchParams.get('ids') ?? searchParams.get('id') ?? '').split(',').map((id) => id.trim()).filter(Boolean);
        if (ids.length === 0) {
            return NextResponse.json({ success: false, error: 'Order ID is required' }, { status: 400 });
        }

        const actor = getAdminActor(request.headers);
        const { data: deleted, error } = await supabase.rpc('delete_orders', {
            p_order_ids: ids,
            p_actor: actor.userId,
            p_actor_email: actor.email,
        });
        if (error) {
            const response = orderErrorResponse(error);
            if (response) return response;
            throw error;
        }

        invalidateCatalog();
        return NextResponse.json({ success: true, data: { deleted } });
    } catch (error: any) {
        console.error('Error deleting order:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

