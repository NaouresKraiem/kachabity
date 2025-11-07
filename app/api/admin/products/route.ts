import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

// GET - Fetch all products
export async function GET(request: NextRequest) {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*, categories(name, slug)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching products:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST - Create a new product
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Generate slug from title if not provided
        const slug = body.slug || body.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        const productData = {
            title: body.title,
            slug: slug,
            description: body.description || null,
            price_cents: parseFloat(body.price_cents),
            currency: body.currency || 'TND',
            discount_percent: body.discount_percent ? parseFloat(body.discount_percent) : null,
            image_url: body.image_url,
            images: Array.isArray(body.images) ? body.images : [],
            stock: parseInt(body.stock),
            rating: body.rating ? parseFloat(body.rating) : 4.5,
            review_count: body.review_count ? parseInt(body.review_count) : 0,
            category_id: body.category_id || null,
            is_featured: body.is_featured || false,
            is_promo: body.is_promo || false,
            promo_end_date: body.promo_end_date || null
        };

        const { data, error } = await supabase
            .from('products')
            .insert([productData])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating product:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update a product
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { success: false, error: 'Product ID is required' },
                { status: 400 }
            );
        }

        // Generate slug from title if title is being updated
        const slug = body.title && !body.slug
            ? body.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
            : body.slug;

        // Only include valid product columns (exclude JOIN results like 'categories')
        const updateData: any = {};

        if (body.title !== undefined) updateData.title = body.title;
        if (slug) updateData.slug = slug;
        if (body.description !== undefined) updateData.description = body.description || null;
        if (body.price_cents !== undefined) updateData.price_cents = parseFloat(body.price_cents);
        if (body.currency !== undefined) updateData.currency = body.currency;
        if (body.discount_percent !== undefined) updateData.discount_percent = body.discount_percent ? parseFloat(body.discount_percent) : null;
        if (body.image_url !== undefined) updateData.image_url = body.image_url;
        if (body.images !== undefined && Array.isArray(body.images)) updateData.images = body.images;
        if (body.stock !== undefined) updateData.stock = parseInt(body.stock);
        if (body.rating !== undefined) updateData.rating = parseFloat(body.rating);
        if (body.review_count !== undefined) updateData.review_count = parseInt(body.review_count);
        if (body.category_id !== undefined) updateData.category_id = body.category_id || null;
        if (body.is_featured !== undefined) updateData.is_featured = body.is_featured;
        if (body.is_promo !== undefined) updateData.is_promo = body.is_promo;
        if (body.promo_end_date !== undefined) updateData.promo_end_date = body.promo_end_date || null;

        const { data, error } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', body.id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error updating product:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete a product
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Product ID is required' },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting product:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

