"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import supabase from '@/lib/supabaseClient';
import { useCart } from "@/lib/cart-context";
import ProductListCard from "./ProductListCard";
import { toggleFavorite, getUserFavorites } from "@/lib/favorites";
import { message } from "antd";

const translations = {
    en: {
        topSold: "Top Sold Products",
        browseProducts: "Browse through some of our most popular products",
        loginToSave: "Please login to save favorites"
    },
    fr: {
        topSold: "Produits les plus vendus",
        browseProducts: "Parcourez certains de nos produits les plus populaires",
        loginToSave: "Veuillez vous connecter pour enregistrer vos favoris"
    },
    ar: {
        topSold: "المنتجات الأكثر مبيعاً",
        browseProducts: "تصفح بعض منتجاتنا الأكثر شعبية",
        loginToSave: "يرجى تسجيل الدخول لحفظ المفضلة"
    }
};

interface Product {
    id: string;
    title: string;
    slug: string;
    description: string;
    price_cents: number;
    currency: string;
    image_url: string;
    category_id: string;
    rating: number;
    review_count: number;
    stock: number;
    is_featured: boolean;
    discount_percent?: number;
}

interface TopProductsProps {
    locale?: string;
}

export default function TopProducts({ locale = 'en' }: TopProductsProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [categoryMap, setCategoryMap] = useState<Map<string, string>>(new Map());
    const [mounted, setMounted] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    const [userId, setUserId] = useState<string | null>(null);
    const { addItem } = useCart();
    const t = translations[locale as keyof typeof translations] || translations.en;

    useEffect(() => {
        setMounted(true);
        fetchUserAndFavorites();
    }, []);

    // Fetch authenticated user and their favorites
    async function fetchUserAndFavorites() {
        try {
            const { data } = await supabase.auth.getUser();
            if (data.user) {
                setUserId(data.user.id);

                // Fetch user's favorites
                const { favorites: userFavorites } = await getUserFavorites(data.user.id);
                const favoriteIds = new Set(userFavorites.map(fav => fav.product_id));
                setFavorites(favoriteIds);
            }
        } catch (error) {
            console.error("Error fetching user favorites:", error);
        }
    }

    useEffect(() => {
        async function fetchProducts() {
            try {
                // Fetch categories first
                const { data: categoriesData, error: categoriesError } = await supabase
                    .from('categories')
                    .select('id, slug');

                if (!categoriesError && categoriesData) {
                    const map = new Map<string, string>(categoriesData.map((cat: { id: string; slug: string }) => [cat.id, cat.slug]));
                    setCategoryMap(map);
                }

                // Fetch products
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .eq('is_featured', true)
                    .order('review_count', { ascending: false })
                    .limit(10);

                if (error) throw error;

                if (data) {
                    setProducts(data);
                }
            } catch (error) {
                console.error('Error fetching products:', error);
            }
        }

        fetchProducts();
    }, []);

    const checkScrollPosition = () => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            setCanScrollLeft(container.scrollLeft > 0);
            setCanScrollRight(
                container.scrollLeft < container.scrollWidth - container.clientWidth - 10
            );
        }
    };

    useEffect(() => {
        if (!mounted) return;

        checkScrollPosition();
        const container = scrollContainerRef.current;
        if (container) {
            container.addEventListener('scroll', checkScrollPosition);
            window.addEventListener('resize', checkScrollPosition);
            return () => {
                container.removeEventListener('scroll', checkScrollPosition);
                window.removeEventListener('resize', checkScrollPosition);
            };
        }
    }, [products, mounted]);

    const handlePrev = () => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollAmount = 280; // Card width + gap
            container.scrollBy({
                left: -scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const handleNext = () => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollAmount = 280; // Card width + gap
            container.scrollBy({
                left: scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const handleToggleFavorite = async (productId: string) => {
        // If user not logged in, show message
        if (!userId) {
            message.error(t.loginToSave);

            return;
        }

        // Optimistically update UI
        setFavorites(prev => {
            const newFavorites = new Set(prev);
            if (newFavorites.has(productId)) {
                newFavorites.delete(productId);
            } else {
                newFavorites.add(productId);
            }
            return newFavorites;
        });

        // Persist to database
        try {
            const { isFavorited, error } = await toggleFavorite(userId, productId);

            if (error) {
                console.error("Error toggling favorite:", error);
                // Revert optimistic update on error
                setFavorites(prev => {
                    const newFavorites = new Set(prev);
                    if (newFavorites.has(productId)) {
                        newFavorites.delete(productId);
                    } else {
                        newFavorites.add(productId);
                    }
                    return newFavorites;
                });
            }
        } catch (error) {
            console.error("Error in handleToggleFavorite:", error);
        }
    };


    return (
        <section className="w-full py-16 px-4 bg-white relative overflow-hidden">


            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <div className="text-center mb-12 ">
                    <h2 className="text-4xl font-bold text-[#2b1a16] mb-2">
                        {t.topSold}
                    </h2>
                    <p className="text-gray-500 text-sm">
                        {t.browseProducts}
                    </p>
                    <Image src="/assets/images/highlight.svg" alt="Decorative" height={100} width={150} className="mx-auto block mt-4" />
                </div>
                {/* Products Carousel */}
                <div className="relative">
                    {/* Products Grid */}
                    <div
                        ref={scrollContainerRef}
                        className="overflow-x-auto scrollbar-hide"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {!mounted || products.length === 0 ? (
                            <div className="flex gap-6 pb-4">
                                {/* Loading skeleton */}
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={i} className="w-64 shrink-0">
                                        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                                            <div className="relative h-64 bg-gray-200 animate-pulse" />
                                            <div className="p-4 space-y-2">
                                                <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                                                <div className="h-3 bg-gray-200 animate-pulse rounded w-1/2" />
                                                <div className="h-6 bg-gray-200 animate-pulse rounded w-1/3" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex gap-6 pb-4" style={{ width: 'max-content' }}>
                                {products.map((product) => (
                                    <ProductListCard
                                        key={product.id}
                                        product={product}
                                        locale={locale}
                                        isFavorite={favorites.has(product.id)}
                                        onToggleFavorite={handleToggleFavorite}
                                        onAddToCart={(p) =>
                                            addItem({
                                                id: p.id,
                                                name: p.title,
                                                price: p.price_cents,
                                                image: p.image_url,
                                                rating: p.rating,
                                                reviewCount: p.review_count,
                                            })
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Navigation Buttons */}
                    {mounted && products.length > 0 && (
                        <>
                            {canScrollLeft && (
                                <button
                                    onClick={handlePrev}
                                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition"
                                    aria-label="Previous"
                                >
                                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}

                            {canScrollRight && (
                                <button
                                    onClick={handleNext}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition"
                                    aria-label="Next"
                                >
                                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </section>
    );
}