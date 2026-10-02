import { NextRequest, NextResponse } from 'next/server';
import { idsFromSearchParams } from '@/lib/request-ids';
import { cachedCatalogQuery, invalidateCatalog } from '@/lib/catalog-cache';
import supabase from '@/lib/supabase-admin';

// GET - Fetch all categories (public access)
export async function GET(request: NextRequest) {
    try {
        // Served from the catalog cache; category writes below call invalidateCatalog().
        const data = await cachedCatalogQuery('api-categories', async () => {
            const { data, error } = await supabase
                .from('categories')
                .select('id, name, name_ar, name_fr, slug, sort_order, is_featured, image_url, parent_id')
                .is('deleted_at', null)
                .order('sort_order', { ascending: true })
                .order('name', { ascending: true });
            if (error) throw error;
            return data ?? [];
        })();

        return NextResponse.json({
            success: true,
            data: data || []
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
            name_ar: body.name_ar || null,
            name_fr: body.name_fr || null,
            parent_id: body.parent_id || null,
        };

        const { data, error } = await supabase
            .from('categories')
            .insert([categoryData])
            .select()
            .single();

        if (error) throw error;

        invalidateCatalog(); // refresh cached storefront data

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
        if (body.name_ar !== undefined) updateData.name_ar = body.name_ar || null;
        if (body.name_fr !== undefined) updateData.name_fr = body.name_fr || null;
        if (body.parent_id !== undefined) {
            if (body.parent_id && body.parent_id === body.id) {
                return NextResponse.json({ success: false, error: 'A category cannot be its own parent' }, { status: 400 });
            }
            updateData.parent_id = body.parent_id || null;
        }

        const { data, error } = await supabase
            .from('categories')
            .update(updateData)
            .eq('id', body.id)
            .select()
            .single();

        if (error) throw error;

        invalidateCatalog(); // refresh cached storefront data

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error updating category:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE ?id= or ?ids=a,b - Soft-delete one or several categories in a single statement.
export async function DELETE(request: NextRequest) {
    try {
        const ids = idsFromSearchParams(new URL(request.url).searchParams);
        if (ids.length === 0) {
            return NextResponse.json({ success: false, error: 'Category ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('categories')
            .update({ deleted_at: new Date().toISOString() })
            .in('id', ids);
        if (error) throw error;

        invalidateCatalog(); // refresh cached storefront data
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting categories:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

