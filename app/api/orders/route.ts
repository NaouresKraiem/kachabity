import { NextRequest, NextResponse } from 'next/server';
import defaultSupabase from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

// Use Service Role Key if available to bypass RLS for admin operations
const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : defaultSupabase;

// Warn if service role key is not set
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set. Admin order operations may fail due to RLS policies.');
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

