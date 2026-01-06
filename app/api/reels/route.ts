import { NextRequest, NextResponse } from 'next/server';
// import supabase from '@/lib/supabaseClient';
// import defaultSupabase from '@/lib/supabaseClient';
// import { createClient } from '@supabase/supabase-js';

import supabase from '@/lib/supabaseClient';

// GET - Fetch all reels
export async function GET(request: NextRequest) {
    try {
        const { data, error } = await supabase
            .from('reels')
            .select('*')
            .eq('active', true)
            .order('sort_order', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching reels:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST - Create a new reel
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const reelData = {
            title: body.title,
            description: body.description || null,
            username: body.username || '@kachabiti',
            thumbnail_url: body.thumbnail_url,
            video_url: body.video_url,
            sort_order: body.sort_order || 0,
            active: body.active !== false,
            is_new: body.is_new || false,
        };

        const { data, error } = await supabase
            .from('reels')
            .insert([reelData])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating reel:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update a reel
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { success: false, error: 'Reel ID is required' },
                { status: 400 }
            );
        }

        const updateData: any = {};
        if (body.title !== undefined) updateData.title = body.title;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.username !== undefined) updateData.username = body.username;
        if (body.thumbnail_url !== undefined) updateData.thumbnail_url = body.thumbnail_url;
        if (body.video_url !== undefined) updateData.video_url = body.video_url;
        if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
        if (body.active !== undefined) updateData.active = body.active;
        if (body.is_new !== undefined) updateData.is_new = body.is_new;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('reels')
            .update(updateData)
            .eq('id', body.id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error updating reel:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete a reel
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { success: false, error: 'Reel ID is required' },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('reels')
            .delete()
            .eq('id', body.id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting reel:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

