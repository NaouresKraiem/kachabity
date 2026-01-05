import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getProductImageUrl } from '@/lib/product-images';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // 1. Fetch top products (limit 10)
        // Ideally sort by sold_count, but falling back to created_at if needed
        // We select sold_count explicitly to ensure it's available
        const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select(`
                id, name, slug, description, base_price, category_id, status, sold_count, created_at,
                product_images (id, image_url, alt_text, is_main, position),
                reviews:reviews (rating)
            `)
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('sold_count', { ascending: false, nullsFirst: false }) // Prioritize sold_count
            .order('created_at', { ascending: false }) // Fallback
            .limit(10);

        if (productsError) {
            console.error("❌ Top products error:", productsError);
            return NextResponse.json({ products: [] });
        }

        if (!productsData || productsData.length === 0) {
            return NextResponse.json({ products: [] });
        }

        // 2. Fetch active discounts for these products
        const productIds = productsData.map(p => p.id);
        const { data: discountsData, error: discountsError } = await supabase
            .from('product_discounts')
            .select('product_id, discount_percent, ends_at')
            .in('product_id', productIds)
            .eq('active', true);

        // Create a map for fast lookup
        const discountMap = new Map<string, { discount_percent: number; ends_at: string | null }>();
        if (discountsData) {
            discountsData.forEach(d => {
                discountMap.set(String(d.product_id), {
                    discount_percent: d.discount_percent,
                    ends_at: d.ends_at
                });
            });
        }

        // 3. Fetch categories to map category_id to slug
        // (Optional: could be done in the component, but cleaner here)
        const { data: categoriesData } = await supabase
            .from('categories')
            .select('id, slug');

        const categoryMap = new Map<string, string>();
        if (categoriesData) {
            categoriesData.forEach(c => categoryMap.set(c.id, c.slug));
        }

        // 4. Transform data
        const topProducts = productsData.map((product: any) => {
            const discount = discountMap.get(String(product.id));
            const categorySlug = product.category_id ? categoryMap.get(product.category_id) || 'all' : 'all';

            const imageUrl = getProductImageUrl(product) || 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400';
            const basePrice = Number(product.base_price ?? 0);

            // Calculate reviews
            const reviews = product.reviews || [];
            const ratedReviews = reviews.filter((r: any) => typeof r?.rating === 'number' && !Number.isNaN(Number(r.rating)));
            const rating = ratedReviews.length > 0
                ? Number((ratedReviews.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / ratedReviews.length).toFixed(1))
                : 0;

            return {
                id: product.id,
                name: product.name,
                title: product.name,
                slug: product.slug,
                description: product.description,
                base_price: basePrice,
                price_cents: basePrice, // Alias for compatibility
                image_url: imageUrl,
                product_images: product.product_images || [],
                category_id: product.category_id,
                categorySlug: categorySlug,
                currency: 'TND',
                status: product.status,

                // Discount info
                discount_percent: discount?.discount_percent,
                promo_end_date: discount?.ends_at || undefined,

                sold_count: Number(product.sold_count) || 0,
                rating,
                review_count: ratedReviews.length,
            };
        });

        return NextResponse.json({ products: topProducts });

    } catch (error: any) {
        console.error('❌ API error:', error);
        return NextResponse.json({ products: [] }, { status: 500 });
    }
}

