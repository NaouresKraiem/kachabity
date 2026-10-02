import { NextRequest, NextResponse } from 'next/server';
import { idsFromSearchParams } from '@/lib/request-ids';
import { invalidateCatalog } from '@/lib/catalog-cache';
import supabase from '@/lib/supabase-admin';
import { getAdminActor } from '@/lib/admin-auth';
import { stockErrorMessage } from '@/lib/stock';

// GET - Fetch all products (public read)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const isAdmin = searchParams.get('admin') === 'true';
        const slug = searchParams.get('slug');

        // Lightweight list for admin tables and pickers: no variants/variant images
        // (~50 KB instead of ~1 MB for the full catalog), just a variant count.
        if (searchParams.get('view') === 'summary') {
            let summary = supabase
                .from('products')
                .select('id, name, name_ar, name_fr, slug, status, base_price, category_id, deleted_at, created_at, categories(name, slug), product_images(id, image_url, alt_text, is_main, position), product_variants!product_variants_product_id_fkey(count)')
                .is('product_images.variant_id', null)
                .order('created_at', { ascending: false });
            if (!isAdmin) summary = summary.eq('status', 'active').is('deleted_at', null);
            const { data, error } = await summary;
            if (error) throw error;
            return NextResponse.json({
                success: true,
                data: (data ?? []).map(({ product_variants, ...p }: { product_variants?: { count: number }[] }) => ({
                    ...p,
                    variant_count: product_variants?.[0]?.count ?? 0,
                })),
            });
        }

        // Build query
        let query = supabase
            .from('products')
            .select('*, categories(name, slug), product_images(*)');

        // Filter by ID if provided
        if (id) {
            query = query.eq('id', id);
        }
        // Filter by Slug if provided
        else if (slug) {
            query = query.eq('slug', slug);
        }

        // Apply filters for non-admin users
        if (!isAdmin) {
            query = query.eq('status', 'active').is('deleted_at', null);
        }

        // Order results
        if (!id && !slug) {
            query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query;

        if (error) throw error;

        // If fetching by ID or Slug, data might be an array of one or empty
        // Supabase .single() would throw if 0 or >1, but we used query without single() initially to chain
        // so data is an array.

        const products = data || [];

        // Fetch variants for all products separately
        if (products.length > 0) {
            const productIds = products.map((p: any) => p.id);
            const { data: variants, error: variantsError } = await supabase
                .from('product_variants')
                .select('*, sizes(*), colors(*)')
                .in('product_id', productIds);

            if (!variantsError && variants) {
                // Attach variants to products
                products.forEach((product: any) => {
                    const productLevelImages = product.product_images || [];

                    product.product_variants = variants
                        .filter((v: any) => v.product_id === product.id)
                        .map((variant: any) => {
                            const variantImages = productLevelImages
                                .filter((img: any) => img.variant_id === variant.id)
                                .map((img: any) => ({
                                    id: img.id,
                                    url: img.image_url,
                                    alt: img.alt_text,
                                    is_main: img.is_main,
                                    position: img.position,
                                }));

                            return {
                                ...variant,
                                images: variantImages,
                            };
                        });

                    // Keep only product-level images (variant_id null) on product if useful
                    product.product_images = productLevelImages.filter((img: any) => !img.variant_id);
                });
            }
        }

        // If ID or Slug was requested, return single object if found
        if ((id || slug) && products.length > 0) {
            return NextResponse.json({ success: true, data: products[0] });
        } else if ((id || slug) && products.length === 0) {
            return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: products });
    } catch (error: any) {
        // console.error('Error fetching products:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// Variant payload for save_product: the shapes the admin forms send, normalised.
function variantPayload(variant: any) {
    const price = variant.price !== undefined && variant.price !== null && variant.price !== ''
        ? parseFloat(variant.price)
        : variant.price_cents !== undefined ? parseFloat(variant.price_cents) / 100 : null;
    return {
        id: variant.id ?? null,
        color_id: variant.color_id || null,
        size_id: variant.size_id || null,
        sku: typeof variant.sku === 'string' ? variant.sku.trim() || null : variant.sku ?? null,
        price,
        // The table only has is_available; is_active is accepted from legacy payloads.
        is_available: variant.is_available !== undefined ? variant.is_available : variant.is_active !== undefined ? variant.is_active : true,
        reorder_point: variant.reorder_point === undefined || variant.reorder_point === null || variant.reorder_point === ''
            ? null
            : Math.max(0, parseInt(variant.reorder_point) || 0),
        // Opening stock (only used when the product is created).
        stock: parseInt(variant.stock) || 0,
        images: Array.isArray(variant.images) ? variant.images : null,
    };
}

function duplicateSkus(variants: { sku: string | null }[]) {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const { sku } of variants) {
        if (!sku) continue;
        if (seen.has(sku)) duplicates.add(sku);
        seen.add(sku);
    }
    return [...duplicates];
}

// Maps save_product errors to responses an admin can act on, or null.
function saveErrorResponse(error: { code?: string; message?: string }) {
    const message = error.message || '';
    if (error.code === '23505' && message.includes('product_variants_sku_key')) {
        return NextResponse.json({ success: false, error: 'SKU must be unique across all variants. Please use distinct SKUs or leave blank.' }, { status: 400 });
    }
    if (error.code === '23505' && message.includes('products_slug_key')) {
        return NextResponse.json({ success: false, error: 'Another product already uses this slug.' }, { status: 409 });
    }
    if (error.code === '23505' && message.includes('products_code_key')) {
        return NextResponse.json({ success: false, error: 'Another product already uses this product code.' }, { status: 409 });
    }
    if (message.includes('variants_with_stock')) {
        return NextResponse.json({ success: false, error: stockErrorMessage(error) }, { status: 409 });
    }
    if (message.includes('product_not_found')) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }
    return null;
}

// The saved product with its images and variants, as the admin forms expect it.
async function loadSavedProduct(productId: string) {
    const [imagesResult, productResult, variantsResult] = await Promise.all([
        supabase.from('product_images').select('*').eq('product_id', productId),
        supabase.from('products').select('*, categories(name, slug)').eq('id', productId).single(),
        supabase.from('product_variants').select('*, sizes(*), colors(*)').eq('product_id', productId),
    ]);
    if (productResult.error) throw productResult.error;
    const images = imagesResult.data ?? [];
    return {
        ...productResult.data,
        product_images: images.filter((img: any) => !img.variant_id),
        product_variants: (variantsResult.data ?? []).map((v: any) => ({
            ...v,
            images: images
                .filter((img: any) => img.variant_id === v.id)
                .map((img: any) => ({ id: img.id, url: img.image_url, alt: img.alt_text, is_main: img.is_main, position: img.position })),
        })),
    };
}

// POST - Create a product. The product, its variants, photos and opening stock are written
// in one transaction (save_product): if anything fails, nothing is created.
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const name = body.name || body.title || '';

        // Unique slug from the name unless one is given.
        const baseSlug = body.slug || (name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        let slug = baseSlug;
        for (let n = 1; ; n++) {
            const { data: existing } = await supabase.from('products').select('id').eq('slug', slug).maybeSingle();
            if (!existing) break;
            slug = `${baseSlug}-${n}`;
        }

        const variants = Array.isArray(body.variants) ? body.variants.map(variantPayload) : [];
        const duplicates = duplicateSkus(variants);
        if (duplicates.length > 0) {
            return NextResponse.json({ success: false, error: `Duplicate SKU(s) in variants: ${duplicates.join(', ')}` }, { status: 400 });
        }

        const actor = getAdminActor(request.headers);
        const { data: productId, error } = await supabase.rpc('save_product', {
            p_product_id: null,
            p_product: {
                name,
                slug,
                description: body.description || null,
                name_ar: body.name_ar || null,
                name_fr: body.name_fr || null,
                description_ar: body.description_ar || null,
                description_fr: body.description_fr || null,
                category_id: body.category_id || null,
                base_price: body.base_price !== undefined ? parseFloat(body.base_price) : body.price_cents !== undefined ? parseFloat(body.price_cents) / 100 : 0,
                status: body.status || 'active',
                supplier_id: body.supplier_id || null,
                collection_id: body.collection_id || null,
                // Blank code: the database generates one from the category.
                code: typeof body.code === 'string' ? body.code : null,
            },
            p_variants: variants,
            p_images: Array.isArray(body.images) ? body.images : [],
            p_actor: actor.userId,
            p_actor_email: actor.email,
        });
        if (error) {
            const response = saveErrorResponse(error);
            if (response) return response;
            throw error;
        }

        invalidateCatalog(); // refresh cached storefront data
        return NextResponse.json({ success: true, data: await loadSavedProduct(productId as string) }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating product:', error);
        return NextResponse.json({ success: false, error: error.message || 'Unable to create product' }, { status: 500 });
    }
}

// PUT - Update a product. Only fields present in the body change. `variants` (the full
// list) and `images` replace the current ones. Everything runs in one transaction
// (save_product); variants are updated in place because their ids carry stock, and
// removing one that still holds stock is refused.
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        if (!body.id) {
            return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
        }

        const changes: Record<string, unknown> = {};
        if (body.name !== undefined) changes.name = body.name;
        if (body.slug !== undefined) {
            changes.slug = body.slug;
        } else if (body.name !== undefined) {
            changes.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }
        for (const field of ['description', 'name_ar', 'name_fr', 'description_ar', 'description_fr', 'category_id', 'code', 'supplier_id', 'collection_id']) {
            if (body[field] !== undefined) changes[field] = typeof body[field] === 'string' ? body[field].trim() || null : body[field];
        }
        if (body.base_price !== undefined) changes.base_price = parseFloat(body.base_price);
        if (body.status !== undefined) changes.status = body.status;
        if (typeof body.stock_tracked === 'boolean') changes.stock_tracked = body.stock_tracked;

        const variants = Array.isArray(body.variants) ? body.variants.map(variantPayload) : null;
        const duplicates = duplicateSkus(variants ?? []);
        if (duplicates.length > 0) {
            return NextResponse.json({ success: false, error: `Duplicate SKU(s) in variants: ${duplicates.join(', ')}` }, { status: 400 });
        }

        const actor = getAdminActor(request.headers);
        const { error } = await supabase.rpc('save_product', {
            p_product_id: body.id,
            p_product: changes,
            p_variants: variants,
            p_images: Array.isArray(body.images) ? body.images : null,
            p_actor: actor.userId,
            p_actor_email: actor.email,
        });
        if (error) {
            const response = saveErrorResponse(error);
            if (response) return response;
            throw error;
        }

        invalidateCatalog(); // refresh cached storefront data
        return NextResponse.json({ success: true, data: await loadSavedProduct(body.id) });
    } catch (error: any) {
        console.error('Error updating product:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE ?id= or ?ids=a,b - Soft-delete one or several products in a single statement.
export async function DELETE(request: NextRequest) {
    try {
        const ids = idsFromSearchParams(new URL(request.url).searchParams);
        if (ids.length === 0) {
            return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('products')
            .update({ deleted_at: new Date().toISOString() })
            .in('id', ids);
        if (error) throw error;

        invalidateCatalog(); // refresh cached storefront data
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting products:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

