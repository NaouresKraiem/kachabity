import { NextRequest, NextResponse } from 'next/server';
import defaultSupabase from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { priceOrder } from '@/lib/order-pricing';
import { sendOrderConfirmationEmail } from '@/lib/order-confirmation-email';

// Use Service Role Key if available to bypass RLS for admin operations
const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : defaultSupabase;

// Warn if service role key is not set
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set. Admin order operations may fail due to RLS policies.');
}

const orderItemSchema = z.object({
    id: z.guid(),
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

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
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
                status: 'pending',
                payment_status: 'pending',
            })
            .select()
            .single();

        if (orderError) throw orderError;

        const { data: orderItems, error: itemsError } = await supabase
            .from('order_items')
            .insert(orderData.items.map((item) => {
                const product = pricing.products.get(item.id)!;
                return {
                    order_id: order.id,
                    product_id: item.id,
                    product_name: product.name,
                    product_name_ar: product.name_ar,
                    product_name_fr: product.name_fr,
                    product_image: product.image,
                    quantity: item.quantity,
                    price: item.price,
                    subtotal: item.price * item.quantity,
                };
            }))
            .select();

        if (itemsError) {
            await supabase.from('orders').delete().eq('id', order.id);
            throw itemsError;
        }

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
        let query = supabase
            .from('orders')
            .select('*')
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

        // If fetching by ID, also fetch order items
        if (id && orders && orders.length > 0) {
            const { data: items, error: itemsError } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', id);

            if (itemsError) throw itemsError;

            return NextResponse.json({
                success: true,
                data: {
                    ...orders[0],
                    items: items || []
                }
            });
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

// PUT - Update order status
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { success: false, error: 'Order ID is required' },
                { status: 400 }
            );
        }

        const updateData: any = {};
        if (body.status !== undefined) updateData.status = body.status;
        if (body.payment_status !== undefined) updateData.payment_status = body.payment_status;
        if (body.order_notes !== undefined) updateData.order_notes = body.order_notes;

        const { data: orders, error } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', body.id)
            .select();

        if (error) {
            console.error('Error updating order:', error);
            if (error.code === '42501') {
                throw new Error('Permission denied to update orders. Set SUPABASE_SERVICE_ROLE_KEY in environment or add RLS policy to allow updates.');
            }
            throw error;
        }

        if (!orders || orders.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Order not found or no permission to update' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: orders[0] });
    } catch (error: any) {
        console.error('Error updating order:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete an order
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Order ID is required' },
                { status: 400 }
            );
        }

        // Delete order items first
        const { error: itemsError } = await supabase
            .from('order_items')
            .delete()
            .eq('order_id', id);

        if (itemsError) throw itemsError;

        // Delete order
        const { error: orderError } = await supabase
            .from('orders')
            .delete()
            .eq('id', id);

        if (orderError) throw orderError;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting order:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

