import { NextRequest, NextResponse } from 'next/server';
import { idsFromSearchParams } from '@/lib/request-ids';
import { cachedCatalogQuery, invalidateCatalog } from '@/lib/catalog-cache';
import supabase from '@/lib/supabase-admin';

// GET - Fetch all sizes (public access)
export async function GET(request: NextRequest) {
    try {
        // Served from the catalog cache; sizes writes below call invalidateCatalog().
        const data = await cachedCatalogQuery('api-sizes', async () => {
            const { data, error } = await supabase
                .from('sizes')
                .select('*')
                .is('deleted_at', null)
                .order('sort_order', { ascending: true })
                .order('name', { ascending: true });
            if (error) throw error;
            return data ?? [];
        })();

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching sizes:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST - Create a new size
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.name) {
            return NextResponse.json(
                { success: false, error: 'Size name is required' },
                { status: 400 }
            );
        }

        const sizeData = {
            name: body.name,
            display_name: body.display_name || null,
            sort_order: body.sort_order || 0,
            description: body.description || null,
        };

        const { data, error } = await supabase
            .from('sizes')
            .insert([sizeData])
            .select()
            .single();

        if (error) throw error;

        invalidateCatalog(); // refresh cached storefront data

        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating size:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update a size
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { success: false, error: 'Size ID is required' },
                { status: 400 }
            );
        }

        const updateData: any = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.display_name !== undefined) updateData.display_name = body.display_name;
        if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
        if (body.description !== undefined) updateData.description = body.description;

        const { data, error } = await supabase
            .from('sizes')
            .update(updateData)
            .eq('id', body.id)
            .select()
            .single();

        if (error) throw error;

        invalidateCatalog(); // refresh cached storefront data

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error updating size:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE ?id= or ?ids=a,b - Soft-delete one or several sizes in a single statement.
export async function DELETE(request: NextRequest) {
    try {
        const ids = idsFromSearchParams(new URL(request.url).searchParams);
        if (ids.length === 0) {
            return NextResponse.json({ success: false, error: 'Size ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('sizes')
            .update({ deleted_at: new Date().toISOString() })
            .in('id', ids);
        if (error) throw error;

        invalidateCatalog(); // refresh cached storefront data
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting sizes:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

