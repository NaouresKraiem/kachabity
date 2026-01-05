import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

// GET - Fetch product images (public read)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('product_id');
        const variantId = searchParams.get('variant_id');

        let query = supabase
            .from('product_images')
            .select('*')
            .order('position', { ascending: true });

        if (productId) {
            query = query.eq('product_id', productId);
        }

        if (variantId) {
            query = query.eq('variant_id', variantId);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching product images:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST - Create product images
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.product_id) {
            return NextResponse.json(
                { success: false, error: 'Product ID is required' },
                { status: 400 }
            );
        }

        // If position is not provided, determine it based on existing images
        let position = body.position;
        if (position === undefined) {
            const { count } = await supabase
                .from('product_images')
                .select('*', { count: 'exact', head: true })
                .eq('product_id', body.product_id)
                .eq('variant_id', body.variant_id || null);

            position = (count || 0);
        }

        const imageData = {
            product_id: body.product_id,
            variant_id: body.variant_id || null,
            image_url: body.image_url,
            alt_text: body.alt_text || null,
            is_main: body.is_main || false,
            position: position,
        };

        const { data, error } = await supabase
            .from('product_images')
            .insert([imageData])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating product image:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update product image
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { success: false, error: 'Image ID is required' },
                { status: 400 }
            );
        }

        const updateData: any = {};
        if (body.image_url !== undefined) updateData.image_url = body.image_url;
        if (body.alt_text !== undefined) updateData.alt_text = body.alt_text;
        if (body.is_main !== undefined) updateData.is_main = body.is_main;
        if (body.position !== undefined) updateData.position = body.position;

        const { data, error } = await supabase
            .from('product_images')
            .update(updateData)
            .eq('id', body.id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error updating product image:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete product image
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Image ID is required' },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('product_images')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting product image:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

