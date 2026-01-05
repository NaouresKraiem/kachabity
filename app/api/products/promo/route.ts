import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getProductImageUrl } from '@/lib/product-images';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // 1) Get active discounts
        const { data: discountsData, error: discountsError } = await supabase
            .from('product_discounts')
            .select('product_id, discount_percent, ends_at')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(6);

        if (discountsError) {
            console.error("❌ Discounts error:", discountsError);
            return NextResponse.json({ products: [] });
        }

        if (!discountsData || discountsData.length === 0) {
            return NextResponse.json({ products: [] });
        }

        const productIds = discountsData.map((d: { product_id: string }) => String(d.product_id));

        const discountMap = new Map<string, { discount_percent: number; ends_at: string | null }>(
            discountsData.map((d: { product_id: string; discount_percent: number; ends_at: string | null }) => [
                String(d.product_id),
                { discount_percent: d.discount_percent, ends_at: d.ends_at }
            ])
        );

        // 2) Get products
        const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select(`
        id, name, slug, base_price,sold_count, category_id,
        product_images (id, image_url, alt_text, is_main, position),
        reviews:reviews (rating)
      `)
            .in('id', productIds)
            .eq('status', 'active')
            .is('deleted_at', null);

        if (productsError) {
            console.error("❌ Products error:", productsError);
            return NextResponse.json({ products: [] });
        }

        if (!productsData || productsData.length === 0) {
            return NextResponse.json({ products: [] });
        }

        // 3) Map productsData to promo format
        const promoProducts = productsData.map((product: any) => {
            const discount: { discount_percent: number; ends_at: string | null } | undefined = discountMap.get(String(product.id));
            const imageUrl = getProductImageUrl(product) || 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400';

            // Mock stock for now to avoid variant relationship error
            const totalStock = 100;

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
                base_price: Number(product.base_price ?? 0),
                price_cents: Number(product.base_price ?? 0),
                image_url: imageUrl,
                category_id: product.category_id,
                currency: 'TND',
                discount_percent: discount?.discount_percent,
                promo_end_date: discount?.ends_at || undefined,
                sold_count: `+ ${product.sold_count}`, // Mock sold_count since column doesn't exist
                // stock: totalStock,
                rating,
                review_count: ratedReviews.length,
            };
        });

        return NextResponse.json({ products: promoProducts });
    } catch (error: any) {
        console.error('❌ API error:', error);
        return NextResponse.json({ products: [] }, { status: 500 });
    }
}

