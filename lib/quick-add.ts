"use client";

import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import { useCart } from "@/lib/cart-context";
import { useLanguage } from "@/lib/language-context";

interface QuickAddProduct {
    id: string;
    slug?: string;
    name: string;
    name_ar?: string;
    name_fr?: string;
    base_price: number;
    discount_percent?: number | null;
    image_url?: string;
    product_images?: { image_url: string; is_main?: boolean }[];
    rating?: number;
    review_count?: number;
}

interface VariantRow {
    id: string;
    price: number | null;
    stock: number;
    colors: { name: string; display_name: string | null } | null;
    sizes: { name: string } | null;
}

/**
 * "Add to cart" from product cards. Orders must record the size/color, so a product with a
 * choice to make (or one that is out of stock) opens its page instead of being added blind.
 */
export function useQuickAdd(fallbackImage = "") {
    const { addItem } = useCart();
    const { locale } = useLanguage();
    const router = useRouter();

    return async (p: QuickAddProduct) => {
        const openProduct = () => {
            if (p.slug) router.push(`/${locale}/products/${p.slug}`);
        };

        const [{ data: variants }, { data: product }] = await Promise.all([
            supabase
                .from("product_variants")
                .select("id, price, stock, colors(name, display_name), sizes(name)")
                .eq("product_id", p.id)
                .is("deleted_at", null)
                .neq("is_available", false),
            supabase.from("products").select("stock_tracked").eq("id", p.id).maybeSingle(),
        ]);
        const options = (variants ?? []) as unknown as VariantRow[];
        if (options.length > 1) return openProduct();

        const variant = options[0];
        if (variant && product?.stock_tracked && variant.stock <= 0) return openProduct();

        const unitPrice = variant?.price ?? p.base_price;
        const price = p.discount_percent ? unitPrice * (1 - p.discount_percent / 100) : unitPrice;
        const image = p.product_images?.length
            ? p.product_images.find((img) => img.is_main)?.image_url || p.product_images[0].image_url
            : p.image_url || fallbackImage;
        const label = variant
            ? [variant.colors?.display_name || variant.colors?.name, variant.sizes?.name].filter(Boolean).join(" / ")
            : "";

        addItem({
            id: p.id,
            variantId: variant?.id,
            variantLabel: label || undefined,
            name: p.name,
            name_ar: p.name_ar,
            name_fr: p.name_fr,
            price: Math.round(price),
            image,
            rating: p.rating || 0,
            reviewCount: p.review_count || 0,
        });
    };
}
