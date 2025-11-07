"use client";

import Image from "next/image";
import Link from "next/link";
import PromoCountdownTimer from "../timers/PromoCountdownTimer";
import StockProgress from "../ui/StockProgress";
import AddToCartButton from "../cart/AddToCartButton";
import type { PromoProduct } from "@/types/product";

interface PromoProductCardProps {
    product: PromoProduct;
    locale?: string;
    categorySlug?: string;
}

export default function PromoProductCard({ product, locale = 'en', categorySlug = 'all' }: PromoProductCardProps) {
    const discountedPrice = product.discount_percent
        ? product.price_cents * (1 - product.discount_percent / 100)
        : product.price_cents;

    // Include category in search params for context
    const productUrl = categorySlug && categorySlug !== "all"
        ? `/${locale}/products/${product.slug}?category=${categorySlug}`
        : `/${locale}/products/${product.slug}`;

    return (
        <div className="rounded-2xl transition-shadow">
            <div className="flex flex-col lg:flex-row">
                <div className="relative w-[280px] lg:w-[220px] xl:w-[250px] 2xl:w-[270px] h-[280px] lg:h-[220px] xl:h-[250px] 2xl:h-[270px] overflow-hidden rounded-[15px] border border-[#E3E3E3] shrink-0 mx-auto lg:mx-0">
                    <Link href={productUrl}>
                        <Image
                            src={product.image_url || "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400"}
                            alt={product.title}
                            fill
                            className="p-0.5 object-cover hover:scale-105 transition-transform duration-300 overflow-hidden rounded-[15px] border"
                        />
                    </Link>
                    {/* Discount Badge */}
                    {product.discount_percent && product.discount_percent > 0 && (
                        <div className="absolute top-3 left-3 bg-[#FCF4F2] px-3 py-1 rounded-[9px] border border-[#842E1B] shadow-md">
                            <span className="text-sm font-medium text-[#842E1B]">
                                -{product.discount_percent}% Discount
                            </span>
                        </div>
                    )}
                </div>

                {/* Product Info */}
                <div className="w-full max-w-[280px] lg:max-w-none lg:flex-1 px-5 flex flex-col justify-between lg:h-[220px] xl:h-[250px] 2xl:h-[270px] min-h-[200px] mx-auto lg:mx-0">
                    <div className="space-y-2.5 pt-5">
                        {/* Title */}
                        <Link href={productUrl}>
                            <h3 className="text-[16px] font-medium text-[#842E1B] hover:text-[#842E1B] transition leading-tight">
                                {product.title}
                            </h3>
                        </Link>

                        {/* Price */}
                        <div className="flex items-baseline gap-2 py-2">
                            <span className="text-[14px] font-medium text-[#000000]">
                                {Math.round(discountedPrice)} {product.currency}
                            </span>
                            {product.discount_percent && product.discount_percent > 0 && (
                                <span className="text-[13px] text-gray-400 line-through">
                                    {product.price_cents} {product.currency}
                                </span>
                            )}
                        </div>

                        {/* Stock Progress */}
                        <StockProgress sold={product.sold_count} inStock={product.stock} />
                    </div>

                    {/* Countdown and Button */}
                    <div className="space-y-3 pb-5">
                        {product.promo_end_date && (
                            <div className="overflow-x-auto">
                                <PromoCountdownTimer targetDate={new Date(product.promo_end_date)} />
                            </div>
                        )}

                        <AddToCartButton
                            product={{
                                id: product.id,
                                name: product.title,
                                price: Math.round(discountedPrice),
                                image: product.image_url || "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400",
                                rating: 4,
                                reviewCount: 4300
                            }}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

