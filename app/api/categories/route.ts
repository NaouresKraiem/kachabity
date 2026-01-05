import { NextRequest, NextResponse } from 'next/server';
import defaultSupabase from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

// Use Service Role Key if available to bypass RLS for admin operations
const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : defaultSupabase;

// Warn if service role key is not set (admin operations may fail due to RLS)
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set. Admin category operations may fail due to RLS policies.');
}

// GET - Fetch all categories (public access)
export async function GET(request: NextRequest) {
    try {
        const { data, error } = await supabase
            .from('categories')
            .select('id, name, slug, sort_order, is_featured, image_url')
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching categories:', error);
            throw error;
        }

        // Filter out soft-deleted categories
        const filteredData = (data || []).filter((cat: any) => {
            return cat.deleted_at === null || cat.deleted_at === undefined;
        });

        return NextResponse.json({
            success: true,
            data: filteredData
        });
    } catch (error: any) {
        console.error('Error fetching categories:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST - Create a new category
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.name) {
            return NextResponse.json(
                { success: false, error: 'Category name is required' },
                { status: 400 }
            );
        }

        // Generate slug from name if not provided
        const slug = body.slug || body.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        const categoryData = {
            name: body.name,
            slug: slug,
            sort_order: body.sort_order || 0,
            is_featured: body.is_featured || false,
            image_url: body.image_url || null,
        };

        const { data, error } = await supabase
            .from('categories')
            .insert([categoryData])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating category:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update a category
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { success: false, error: 'Category ID is required' },
                { status: 400 }
            );
        }

        const updateData: any = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.slug !== undefined) updateData.slug = body.slug;
        if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
        if (body.is_featured !== undefined) updateData.is_featured = body.is_featured;
        if (body.image_url !== undefined) updateData.image_url = body.image_url;

        const { data, error } = await supabase
            .from('categories')
            .update(updateData)
            .eq('id', body.id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error updating category:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete a category
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Category ID is required' },
                { status: 400 }
            );
        }

        // Try soft delete first (if deleted_at column exists)
        const { error: softDeleteError } = await supabase
            .from('categories')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (softDeleteError) {
            // If soft delete fails (column doesn't exist), do hard delete
            const { error: deleteError } = await supabase
                .from('categories')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting category:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

