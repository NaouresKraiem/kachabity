"use client";

import Image from "next/image";
import Link from "next/link";
import AddToCartButton from "../cart/AddToCartButton";

interface ProductCardProps {
    product: {
        id: string;
        title: string;
        slug: string;
        price_cents: number;
        currency: string;
        discount_percent?: number;
        image_url: string;
        rating?: number;
        review_count?: number;
        category_id?: string;
    };
    locale: string;
    categorySlug?: string;
    variant?: "grid" | "list";
    onWishlistToggle?: (productId: string) => void;
    isInWishlist?: boolean;
    reviewsText?: string;
}

export default function ProductCard({
    product,
    locale,
    categorySlug = "all",
    onWishlistToggle,
    isInWishlist = false,
    reviewsText = "reviews"
}: ProductCardProps) {
    const discountedPrice = product.discount_percent
        ? product.price_cents * (1 - product.discount_percent / 100)
        : product.price_cents;

    // Include category in search params for context
    const productUrl = categorySlug && categorySlug !== "all"
        ? `/${locale}/products/${product.slug}?category=${categorySlug}`
        : `/${locale}/products/${product.slug}`;

    return (
        <div className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition">
            {/* Product Image */}
            <Link href={productUrl} className="block relative aspect-square overflow-hidden bg-gray-50">
                <Image
                    src={product.image_url}
                    alt={product.title || "Product image"}
                    fill
                    className="object-cover group-hover:scale-105 transition"
                />

                {/* Discount Badge */}
                {product.discount_percent && product.discount_percent > 0 && (
                    <div className="absolute top-3 left-3 bg-white px-3 py-1 rounded-full shadow-md">
                        <span className="text-xs font-semibold text-[#842E1B]">
                            -{product.discount_percent}% Discount
                        </span>
                    </div>
                )}

                {/* Wishlist Button */}
                {onWishlistToggle && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onWishlistToggle(product.id);
                        }}
                        className="absolute top-3 right-3 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition"
                        aria-label="Add to wishlist"
                    >
                        <svg
                            className={`w-5 h-5 ${isInWishlist ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
                            fill={isInWishlist ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                    </button>
                )}
            </Link>

            {/* Product Info */}
            <div className="p-4">
                <Link href={productUrl}>
                    <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2 hover:text-[#842E1B] transition">
                        {product.title}
                    </h3>
                </Link>

                {/* Rating */}
                {product.rating !== undefined && (
                    <div className="flex items-center gap-2 mb-3">
                        <div className="flex text-yellow-400">
                            {[...Array(5)].map((_, i) => (
                                <svg
                                    key={i}
                                    className={`w-4 h-4 ${i < Math.floor(product.rating || 0)
                                        ? 'fill-current'
                                        : 'fill-gray-300'
                                        }`}
                                    viewBox="0 0 20 20"
                                >
                                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                                </svg>
                            ))}
                        </div>
                        <span className="text-xs text-gray-600">
                            {product.rating?.toFixed(1)} ({product.review_count || 0} {reviewsText})
                        </span>
                    </div>
                )}

                {/* Price and Add to Cart */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-lg font-bold text-gray-900">
                            {Math.round(discountedPrice)} {product.currency}
                        </p>
                        {product.discount_percent && product.discount_percent > 0 && (
                            <p className="text-sm text-gray-400 line-through">
                                {product.price_cents} {product.currency}
                            </p>
                        )}
                    </div>
                    <AddToCartButton
                        product={{
                            id: product.id,
                            name: product.title,
                            price: Math.round(discountedPrice),
                            image: product.image_url,
                            rating: product.rating || 0,
                            reviewCount: product.review_count || 0
                        }}
                        variant="icon"
                    />
                </div>
            </div>
        </div>
    );
}

