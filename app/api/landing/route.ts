import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase-admin';
import { invalidateCatalog } from '@/lib/catalog-cache';
import { getAdminActor } from '@/lib/admin-auth';
import { LANDING_SECTIONS, normalizeLandingConfig, parseLandingConfig, type LandingSection } from '@/lib/landing-config';

export const dynamic = 'force-dynamic';

// Home page curation (Admin → Landing page). Middleware limits this route to `marketing`.

const isIdList = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((id) => typeof id === 'string');

// GET - Product picks per section (in order), featured categories (in order) and the layout config.
export async function GET() {
    try {
        const [picksResult, configResult, featuredResult] = await Promise.all([
            supabase
                .from('landing_products')
                .select('section, product_id, position')
                .is('deleted_at', null)
                .order('position', { ascending: true }),
            supabase.from('site_settings').select('setting_value').eq('setting_key', 'landing_config').maybeSingle(),
            supabase
                .from('categories')
                .select('id')
                .eq('is_featured', true)
                .is('deleted_at', null)
                .order('featured_position', { ascending: true, nullsFirst: false })
                .order('sort_order', { ascending: true }),
        ]);
        if (picksResult.error) throw picksResult.error;
        if (configResult.error) throw configResult.error;
        if (featuredResult.error) throw featuredResult.error;

        const picks = (picksResult.data ?? []) as { section: LandingSection; product_id: string }[];
        const sections = Object.fromEntries(LANDING_SECTIONS.map((section) => [
            section,
            picks.filter((row) => row.section === section).map((row) => row.product_id),
        ]));

        return NextResponse.json({
            success: true,
            data: {
                sections,
                config: parseLandingConfig(configResult.data?.setting_value),
                featuredCategories: (featuredResult.data ?? []).map((row: { id: string }) => row.id),
            },
        });
    } catch (error) {
        console.error('Error fetching landing picks:', error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}

// PUT - Any combination of:
//   { section, product_ids }      replaces a section's picks (in that order; removed picks are soft-deleted)
//   { config }                    saves the layout and list settings
//   { featured_category_ids }     sets the featured categories, in that order
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const hasPicks = body.section !== undefined;
        if (!hasPicks && body.config === undefined && body.featured_category_ids === undefined) {
            return NextResponse.json({ success: false, error: 'Nothing to save' }, { status: 400 });
        }

        if (hasPicks) {
            if (!LANDING_SECTIONS.includes(body.section)) {
                return NextResponse.json({ success: false, error: 'Unknown section' }, { status: 400 });
            }
            if (!isIdList(body.product_ids)) {
                return NextResponse.json({ success: false, error: 'product_ids must be a list of product ids' }, { status: 400 });
            }
        }
        if (body.featured_category_ids !== undefined && !isIdList(body.featured_category_ids)) {
            return NextResponse.json({ success: false, error: 'featured_category_ids must be a list of category ids' }, { status: 400 });
        }

        // Picks, settings and featured categories in one transaction (any may be omitted).
        const { error } = await supabase.rpc('save_landing_page', {
            p_section: hasPicks ? body.section : null,
            p_product_ids: hasPicks ? [...new Set(body.product_ids as string[])] : null,
            p_config: body.config !== undefined ? normalizeLandingConfig(body.config) : null,
            p_featured_category_ids: body.featured_category_ids !== undefined
                ? [...new Set(body.featured_category_ids as string[])]
                : null,
            p_actor: getAdminActor(request.headers).userId,
        });
        if (error) throw error;

        invalidateCatalog(); // refresh cached storefront data
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving landing page:', error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
