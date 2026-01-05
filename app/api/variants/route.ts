import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

// GET - Fetch variants for a product (public read)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('product_id');

        if (!productId) {
            return NextResponse.json(
                { success: false, error: 'Product ID is required' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('product_variants')
            .select('*, sizes(*), colors(*)')
            .eq('product_id', productId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching variants:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST - Create a new variant
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.product_id) {
            return NextResponse.json(
                { success: false, error: 'Product ID is required' },
                { status: 400 }
            );
        }

        const variantData = {
            product_id: body.product_id,
            size_id: body.size_id || null,
            color_id: body.color_id || null,
            sku: body.sku || null,
            price: body.price !== undefined 
                ? parseFloat(body.price) 
                : (body.price_cents !== undefined ? parseFloat(body.price_cents) / 100 : null),
            stock: parseInt(body.stock) || 0,
            is_available: body.is_available !== undefined ? body.is_available : true,
        };

        const { data, error } = await supabase
            .from('product_variants')
            .insert([variantData])
            .select('*, sizes(*), colors(*)')
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating variant:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update a variant
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { success: false, error: 'Variant ID is required' },
                { status: 400 }
            );
        }

        const updateData: any = {};

        if (body.size_id !== undefined) updateData.size_id = body.size_id || null;
        if (body.color_id !== undefined) updateData.color_id = body.color_id || null;
        if (body.sku !== undefined) updateData.sku = body.sku || null;
        if (body.price !== undefined) {
            updateData.price = parseFloat(body.price);
        } else if (body.price_cents !== undefined) {
            updateData.price = parseFloat(body.price_cents) / 100;
        }
        if (body.stock !== undefined) updateData.stock = parseInt(body.stock);
        if (body.is_available !== undefined) updateData.is_available = body.is_available;

        const { data, error } = await supabase
            .from('product_variants')
            .update(updateData)
            .eq('id', body.id)
            .select('*, sizes(*), colors(*)')
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error updating variant:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete a variant
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Variant ID is required' },
                { status: 400 }
            );
        }

        // Try soft delete first
        const { error: softDeleteError } = await supabase
            .from('product_variants')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (softDeleteError) {
            // If soft delete fails, do hard delete
            const { error: deleteError } = await supabase
                .from('product_variants')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting variant:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

