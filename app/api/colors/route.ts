import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
// GET - Fetch all colors (public access)
export async function GET(request: NextRequest) {
    try {
        const { data, error } = await supabase
            .from('colors')
            .select('*')
            .is('deleted_at', null)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching colors:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST - Create a new color
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.name) {
            return NextResponse.json(
                { success: false, error: 'Color name is required' },
                { status: 400 }
            );
        }

        const colorData = {
            name: body.name,
            hex_code: body.hex_code || null,
            rgb_code: body.rgb_code || null,
            display_name: body.display_name || null,
            sort_order: body.sort_order || 0,
            description: body.description || null,
        };

        const { data, error } = await supabase
            .from('colors')
            .insert([colorData])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating color:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update a color
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { success: false, error: 'Color ID is required' },
                { status: 400 }
            );
        }

        const updateData: any = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.hex_code !== undefined) updateData.hex_code = body.hex_code;
        if (body.rgb_code !== undefined) updateData.rgb_code = body.rgb_code;
        if (body.display_name !== undefined) updateData.display_name = body.display_name;
        if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
        if (body.description !== undefined) updateData.description = body.description;

        const { data, error } = await supabase
            .from('colors')
            .update(updateData)
            .eq('id', body.id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error updating color:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete a color
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Color ID is required' },
                { status: 400 }
            );
        }

        // Soft delete
        const { error } = await supabase
            .from('colors')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting color:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

