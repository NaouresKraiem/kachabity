import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

// GET - Fetch all categories
export async function GET(request: NextRequest) {
    try {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching categories:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}


