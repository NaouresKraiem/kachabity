import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

// GET - Fetch all sale banners
export async function GET(request: NextRequest) {
    try {
        const { data, error } = await supabase
            .from('promotions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching sale banners:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST - Create a new sale banner
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const bannerData = {
            title: body.title,
            subtitle: body.subtitle || null,
            badge_text: body.badge_text || null,
            discount_percent: parseInt(body.discount_percent) || 0,
            image_url: body.image_url,
            starts_at: body.starts_at,
            ends_at: body.ends_at,
            active: body.active !== false,
        };

        const { data, error } = await supabase
            .from('promotions')
            .insert([bannerData])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating sale banner:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update a sale banner
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { success: false, error: 'Banner ID is required' },
                { status: 400 }
            );
        }

        const updateData: any = {};
        if (body.title !== undefined) updateData.title = body.title;
        if (body.subtitle !== undefined) updateData.subtitle = body.subtitle;
        if (body.badge_text !== undefined) updateData.badge_text = body.badge_text;
        if (body.discount_percent !== undefined) updateData.discount_percent = parseInt(body.discount_percent) || 0;
        if (body.image_url !== undefined) updateData.image_url = body.image_url;
        if (body.starts_at !== undefined) updateData.starts_at = body.starts_at;
        if (body.ends_at !== undefined) updateData.ends_at = body.ends_at;
        if (body.active !== undefined) updateData.active = body.active;

        const { data, error } = await supabase
            .from('promotions')
            .update(updateData)
            .eq('id', body.id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error updating sale banner:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete a sale banner
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { success: false, error: 'Banner ID is required' },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('promotions')
            .delete()
            .eq('id', body.id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting sale banner:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

