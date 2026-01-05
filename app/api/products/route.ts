import { NextRequest, NextResponse } from 'next/server';
import defaultSupabase from '@/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Use Service Role Key if available to bypass RLS for admin operations
const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : defaultSupabase;

// Warn if service role key is not set (admin operations may fail due to RLS)
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set. Admin product operations may fail due to RLS policies.');
}

// GET - Fetch all products (public read)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const isAdmin = searchParams.get('admin') === 'true';
        const slug = searchParams.get('slug');

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

        let products = data || [];

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

// POST - Create a new product
export async function POST(request: NextRequest) {
    // Track created product for cleanup if later steps fail
    let createdProductId: string | null = null;

    try {
        const body = await request.json();

        // Generate slug from name if not provided
        let slug = body.slug || (body.name || body.title || 'product')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        // Convert price to base_price (accept both price and base_price for compatibility)
        const basePrice = body.base_price !== undefined
            ? parseFloat(body.base_price)
            : (body.price_cents !== undefined ? parseFloat(body.price_cents) / 100 : 0);

        // Get name (accept both name and title for compatibility)
        const name = body.name || body.title || '';

        // Ensure slug is unique
        let uniqueSlug = slug;
        let slugCounter = 1;
        while (true) {
            // Check if slug exists
            const { data: existing, error: checkError } = await supabase
                .from('products')
                .select('id')
                .eq('slug', uniqueSlug)
                .maybeSingle();

            if (!existing) break; // Slug is available

            // Slug taken, append counter
            uniqueSlug = `${slug}-${slugCounter}`;
            slugCounter++;
        }
        slug = uniqueSlug;

        const productData = {
            name: name,
            slug: slug,
            description: body.description || null,
            category_id: body.category_id || null,
            base_price: basePrice,
            status: body.status || 'active'
        };

        const { data: product, error } = await supabase
            .from('products')
            .insert([productData])
            .select()
            .single();

        if (error) throw error;
        createdProductId = product.id;

        // If variants are provided, create them
        // Use only normalized columns that exist in product_variants (size_id, color_id, etc.)
        if (body.variants && Array.isArray(body.variants) && body.variants.length > 0) {
            const variantRows = body.variants.map((variant: any) => {
                const rawSku = typeof variant.sku === 'string' ? variant.sku.trim() : variant.sku;
                const normalizedSku = rawSku ? rawSku : null; // avoid duplicate '' violating unique constraint
                return {
                    id: variant.id || randomUUID(),
                    product_id: product.id,
                    size_id: variant.size_id || null,
                    color_id: variant.color_id || null,
                    sku: normalizedSku,
                    price: variant.price !== undefined
                        ? parseFloat(variant.price)
                        : (variant.price_cents !== undefined ? parseFloat(variant.price_cents) / 100 : null),
                    stock: parseInt(variant.stock) || 0,
                    // The table only has is_available (no is_active); fallback to is_active for legacy payloads
                    is_available: variant.is_available !== undefined
                        ? variant.is_available
                        : (variant.is_active !== undefined ? variant.is_active : true),
                };
            });

            // Validate duplicate SKUs in the incoming payload to avoid DB constraint errors
            const seenSkus = new Set<string>();
            const duplicateSkus: string[] = [];
            for (const v of variantRows) {
                if (v.sku) {
                    if (seenSkus.has(v.sku)) {
                        duplicateSkus.push(v.sku);
                    } else {
                        seenSkus.add(v.sku);
                    }
                }
            }
            if (duplicateSkus.length > 0) {
                return NextResponse.json(
                    { success: false, error: `Duplicate SKU(s) in variants: ${[...new Set(duplicateSkus)].join(', ')}` },
                    { status: 400 }
                );
            }

            const { data: insertedVariants, error: variantsError } = await supabase
                .from('product_variants')
                .insert(variantRows)
                .select();

            if (variantsError) {
                // Friendly message for SKU unique constraint
                if (variantsError.code === '23505' && (variantsError.message || '').includes('product_variants_sku_key')) {
                    return NextResponse.json(
                        { success: false, error: 'SKU must be unique across all variants. Please use distinct SKUs or leave blank.' },
                        { status: 400 }
                    );
                }
                console.error('Error creating variants:', variantsError);
                // Bubble up so the client knows the request failed
                throw variantsError;
            }

            // Insert variant images if provided
            const variantImagesToInsert: any[] = [];
            body.variants.forEach((variant: any) => {
                const variantId = variant.id || insertedVariants?.find((v: any) =>
                    v.sku === (typeof variant.sku === 'string' ? variant.sku.trim() : variant.sku) &&
                    v.size_id === (variant.size_id || null) &&
                    v.color_id === (variant.color_id || null)
                )?.id;

                if (!variantId) return;

                if (variant.images && Array.isArray(variant.images) && variant.images.length > 0) {
                    variant.images.forEach((img: any, index: number) => {
                        variantImagesToInsert.push({
                            id: randomUUID(),
                            product_id: product.id,
                            variant_id: variantId,
                            image_url: typeof img === 'string' ? img : img.url,
                            alt_text: typeof img === 'object' ? img.alt : null,
                            is_main: index === 0 || (typeof img === 'object' && img.is_main),
                            position: typeof img === 'object' && img.position !== undefined ? img.position : index,
                        });
                    });
                }
            });

            if (variantImagesToInsert.length > 0) {
                const { error: variantImagesError } = await supabase
                    .from('product_images')
                    .insert(variantImagesToInsert);

                if (variantImagesError) {
                    console.error('Error creating variant images:', variantImagesError);
                    throw variantImagesError;
                }
            }
        }

        // Handle product images if provided
        // We do this BEFORE fetching the final product to ensure images are included
        if (body.images && Array.isArray(body.images) && body.images.length > 0) {
            console.log('Attempting to insert images:', JSON.stringify(body.images));

            const images = body.images.map((img: any, index: number) => ({
                id: randomUUID(), // ensure unique primary key value
                product_id: product.id,
                variant_id: null,
                image_url: typeof img === 'string' ? img : img.url,
                alt_text: typeof img === 'object' ? img.alt : null,
                is_main: index === 0 || (typeof img === 'object' && img.is_main),
                position: index,
            }));

            // Force cache invalidation by waiting
            const { data: insertedImages, error: imagesError } = await supabase
                .from('product_images')
                .insert(images)
                .select();

            if (imagesError) {
                console.error('CRITICAL ERROR creating product images:', imagesError);
                // Throw error to notify client
                throw new Error(`Failed to save images: ${imagesError.message}`);
            } else {
                console.log('Successfully inserted images:', insertedImages?.length, 'rows');
            }
        } else {
            console.log('No images provided in request body');
        }

        // Fetch the product with variants and images
        // We fetch variants separately to avoid the "multiple relationships found" error
        // Add a small delay to ensure data consistency
        await new Promise(resolve => setTimeout(resolve, 500));

        // Fetch images explicitly to ensure they are returned
        const { data: productImages, error: imagesFetchError } = await supabase
            .from('product_images')
            .select('*')
            .eq('product_id', product.id);

        const { data: fetchedProduct, error: fetchError } = await supabase
            .from('products')
            .select('*, categories(name, slug)')
            .eq('id', product.id)
            .single();

        if (fetchError) {
            console.error('Error fetching created product:', fetchError);
            // Return product without relations if fetch fails
            return NextResponse.json({ success: true, data: product }, { status: 201 });
        }

        // Attach images to product
        fetchedProduct.product_images = productImages || [];

        // Fetch variants separately
        const { data: variantsData } = await supabase
            .from('product_variants')
            .select('*, sizes(*), colors(*)')
            .eq('product_id', product.id);

        // Attach variant images from product_images where variant_id matches
        const variantImagesById: Record<string, any[]> = {};
        (productImages || []).forEach((img: any) => {
            if (img.variant_id) {
                if (!variantImagesById[img.variant_id]) variantImagesById[img.variant_id] = [];
                variantImagesById[img.variant_id].push({
                    id: img.id,
                    url: img.image_url,
                    alt: img.alt_text,
                    is_main: img.is_main,
                    position: img.position,
                });
            }
        });

        const productWithVariants = {
            ...fetchedProduct,
            product_variants: (variantsData || []).map((v: any) => ({
                ...v,
                images: variantImagesById[v.id] || [],
            }))
        };

        return NextResponse.json({ success: true, data: productWithVariants }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating product:', error);

        // Best-effort cleanup to avoid empty/orphaned products if a later step fails (e.g., variants/images)
        try {
            if (createdProductId) {
                // Delete product images first, then variants, then product
                await supabase.from('product_images').delete().eq('product_id', createdProductId);
                await supabase.from('product_variants').delete().eq('product_id', createdProductId);
                await supabase.from('products').delete().eq('id', createdProductId);
            }
        } catch (cleanupError) {
            console.error('Cleanup after product creation failure failed:', cleanupError);
        }

        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update a product
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.id) {
            return NextResponse.json(
                { success: false, error: 'Product ID is required' },
                { status: 400 }
            );
        }

        // Generate slug from name if name is being updated
        const updateData: any = {};
        if (body.name !== undefined) updateData.name = body.name;
        if (body.slug !== undefined) {
            updateData.slug = body.slug;
        } else if (body.name !== undefined) {
            updateData.slug = body.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
        }
        if (body.description !== undefined) updateData.description = body.description || null;
        if (body.category_id !== undefined) updateData.category_id = body.category_id || null;
        if (body.base_price !== undefined) updateData.base_price = parseFloat(body.base_price);
        if (body.status !== undefined) updateData.status = body.status;

        const { data: product, error } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', body.id)
            .select()
            .single();

        if (error) throw error;

        // Handle variants update (and variant images) if provided
        if (body.variants !== undefined && Array.isArray(body.variants)) {
            console.log(`Updating variants for product ${body.id}. Using service role: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);

            // Delete existing variant images (so we can re-insert cleanly)
            const { data: deletedImages, error: deleteVariantImagesError } = await supabase
                .from('product_images')
                .delete()
                .eq('product_id', body.id)
                .not('variant_id', 'is', null);
            if (deleteVariantImagesError) {
                console.error('Error deleting old variant images:', deleteVariantImagesError);
                throw deleteVariantImagesError;
            }
            console.log(`Deleted ${deletedImages?.length || 0} variant images`);

            // Delete existing variants
            const { data: deletedVariants, error: deleteVariantsError } = await supabase
                .from('product_variants')
                .delete()
                .eq('product_id', body.id)
                .select();
            if (deleteVariantsError) {
                console.error('Error deleting old variants:', deleteVariantsError);
                if (deleteVariantsError.code === '42501') {
                    throw new Error('Permission denied to delete variants. Set SUPABASE_SERVICE_ROLE_KEY in environment or add RLS policy to allow deletes.');
                }
                throw new Error(`Failed to delete existing variants: ${deleteVariantsError.message}`);
            }
            console.log(`Deleted ${deletedVariants?.length || 0} existing variants`);

            // Insert new variants (with stable IDs so we can attach images)
            if (body.variants.length > 0) {
                const variantRows = body.variants.map((variant: any) => {
                    const rawSku = typeof variant.sku === 'string' ? variant.sku.trim() : variant.sku;
                    const normalizedSku = rawSku ? rawSku : null; // avoid duplicate '' violating unique constraint
                    return {
                        id: variant.id || randomUUID(),
                        product_id: body.id,
                        size_id: variant.size_id || null,
                        color_id: variant.color_id || null,
                        sku: normalizedSku,
                        price: variant.price !== undefined
                            ? parseFloat(variant.price)
                            : (variant.price_cents !== undefined ? parseFloat(variant.price_cents) / 100 : null),
                        stock: parseInt(variant.stock) || 0,
                        is_available: variant.is_available !== undefined ? variant.is_available : true,
                    };
                });

                // Validate duplicate SKUs in the incoming payload to avoid DB constraint errors
                const seenSkus = new Set<string>();
                const duplicateSkus: string[] = [];
                for (const v of variantRows) {
                    if (v.sku) {
                        if (seenSkus.has(v.sku)) {
                            duplicateSkus.push(v.sku);
                        } else {
                            seenSkus.add(v.sku);
                        }
                    }
                }
                if (duplicateSkus.length > 0) {
                    return NextResponse.json(
                        { success: false, error: `Duplicate SKU(s) in variants: ${[...new Set(duplicateSkus)].join(', ')}` },
                        { status: 400 }
                    );
                }

                const { data: insertedVariants, error: variantsError } = await supabase
                    .from('product_variants')
                    .insert(variantRows)
                    .select();

                if (variantsError) {
                    if (variantsError.code === '23505' && (variantsError.message || '').includes('product_variants_sku_key')) {
                        return NextResponse.json(
                            { success: false, error: 'SKU must be unique across all variants. Please use distinct SKUs or leave blank.' },
                            { status: 400 }
                        );
                    }
                    console.error('Error updating variants:', variantsError);
                    throw variantsError;
                }

                // Map inserted variants by id for image attachment
                const variantIdSet = new Set((insertedVariants || []).map((v: any) => v.id));

                // Insert variant images if provided
                const variantImagesToInsert: any[] = [];
                body.variants.forEach((variant: any) => {
                    const variantId = variant.id || variantRows.find((vr: any) =>
                        vr.sku === variant.sku &&
                        vr.size_id === (variant.size_id || null) &&
                        vr.color_id === (variant.color_id || null)
                    )?.id;

                    // Fallback: if variant had no id and we cannot find by attributes, skip images
                    if (!variantId || !variantIdSet.has(variantId)) return;

                    if (variant.images && Array.isArray(variant.images) && variant.images.length > 0) {
                        variant.images.forEach((img: any, index: number) => {
                            variantImagesToInsert.push({
                                id: randomUUID(),
                                product_id: body.id,
                                variant_id: variantId,
                                image_url: typeof img === 'string' ? img : img.url,
                                alt_text: typeof img === 'object' ? img.alt : null,
                                is_main: index === 0 || (typeof img === 'object' && img.is_main),
                                position: typeof img === 'object' && img.position !== undefined ? img.position : index,
                            });
                        });
                    }
                });

                if (variantImagesToInsert.length > 0) {
                    const { error: variantImagesError } = await supabase
                        .from('product_images')
                        .insert(variantImagesToInsert);
                    if (variantImagesError) {
                        console.error('Error inserting variant images:', variantImagesError);
                        throw variantImagesError;
                    }
                }
            }
        }

        // Handle product images update if provided
        if (body.images !== undefined && Array.isArray(body.images)) {
            console.log('Updating images for product:', body.id);

            // Delete existing product-level images
            const { error: deleteError } = await supabase
                .from('product_images')
                .delete()
                .eq('product_id', body.id)
                .is('variant_id', null);

            if (deleteError) {
                console.error('Error deleting old product images:', deleteError);
            }

            // Insert new images if any
            if (body.images.length > 0) {
                const images = body.images.map((img: any, index: number) => ({
                    id: randomUUID(),
                    product_id: body.id,
                    variant_id: null,
                    image_url: typeof img === 'string' ? img : img.url,
                    alt_text: typeof img === 'object' ? img.alt : null,
                    is_main: index === 0 || (typeof img === 'object' && img.is_main),
                    position: typeof img === 'object' && img.position !== undefined ? img.position : index,
                }));

                const { error: imagesError } = await supabase
                    .from('product_images')
                    .insert(images);

                if (imagesError) {
                    console.error('Error updating product images:', imagesError);
                    throw new Error(`Failed to save images: ${imagesError.message}`);
                }
            }
        }

        // Fetch the product with variants and images
        // We fetch variants separately to avoid the "multiple relationships found" error
        // Add a small delay to ensure data consistency
        await new Promise(resolve => setTimeout(resolve, 500));

        // Fetch images explicitly to ensure they are returned
        const { data: productImages, error: imagesFetchError } = await supabase
            .from('product_images')
            .select('*')
            .eq('product_id', body.id);

        const { data: fetchedProduct, error: fetchError } = await supabase
            .from('products')
            .select('*, categories(name, slug)')
            .eq('id', body.id)
            .single();

        if (fetchError) {
            console.error('Error fetching updated product:', fetchError);
            return NextResponse.json({ success: true, data: product });
        }

        // Attach images to product
        fetchedProduct.product_images = productImages || [];

        // Fetch variants separately
        const { data: variantsData } = await supabase
            .from('product_variants')
            .select('*, sizes(*), colors(*)')
            .eq('product_id', body.id);

        const productWithVariants = {
            ...fetchedProduct,
            product_variants: variantsData || []
        };

        return NextResponse.json({ success: true, data: productWithVariants });
    } catch (error: any) {
        console.error('Error updating product:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete a product
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Product ID is required' },
                { status: 400 }
            );
        }

        // Try soft delete first (if deleted_at column exists)
        const { error: softDeleteError } = await supabase
            .from('products')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (softDeleteError) {
            // If soft delete fails (column doesn't exist), do hard delete
            const { error: deleteError } = await supabase
                .from('products')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting product:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

