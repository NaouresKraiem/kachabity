import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

// GET - Fetch all promotions
export async function GET(request: NextRequest) {
    try {
        const { data, error } = await supabase
            .from('product_discounts')
            .select(`
                *,
                products (
                    id,
                    name,
                    base_price
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching promotions:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST - Create a new promotion
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const promotionData = {
            product_id: body.product_id,
            discount_percent: parseFloat(body.discount_percent),
            starts_at: body.starts_at || null,
            ends_at: body.ends_at || null,
            active: body.active !== false,
        };

        const { data, error } = await supabase
            .from('product_discounts')
            .insert([promotionData])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating promotion:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update a promotion
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { success: false, error: 'Promotion ID is required' },
                { status: 400 }
            );
        }

        const updateData: any = {};
        if (body.product_id !== undefined) updateData.product_id = body.product_id;
        if (body.discount_percent !== undefined) updateData.discount_percent = parseFloat(body.discount_percent);
        if (body.starts_at !== undefined) updateData.starts_at = body.starts_at;
        if (body.ends_at !== undefined) updateData.ends_at = body.ends_at;
        if (body.active !== undefined) updateData.active = body.active;

        const { data, error } = await supabase
            .from('product_discounts')
            .update(updateData)
            .eq('id', body.id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error updating promotion:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete a promotion
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { success: false, error: 'Promotion ID is required' },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('product_discounts')
            .delete()
            .eq('id', body.id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting promotion:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}



