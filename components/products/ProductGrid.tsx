"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import supabase from '@/lib/supabaseClient';
import Link from "next/link";

interface Category {
    id: string;
    name: string;
    slug: string;
    image_url: string;
    sort_order: number;
    is_featured?: boolean;
}

interface ProductGridProps {
    locale?: string;
}

export default function ProductGrid({ locale = 'en' }: ProductGridProps) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [mounted, setMounted] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        async function fetchCategories() {
            try {
                const { data, error } = await supabase
                    .from('categories')
                    .select('id, name, slug, image_url, sort_order, is_featured')
                    .eq('is_featured', true)
                    .order('sort_order', { ascending: true });

                if (error) throw error;

                if (data) {
                    setCategories(data);
                }
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        }

        fetchCategories();
    }, []);

    // Check scroll position to enable/disable buttons
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
    }, [categories, mounted]);

    const handlePrev = () => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollAmount = 224; // Card width (208px) + gap (16px)
            container.scrollBy({
                left: -scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const handleNext = () => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollAmount = 224; // Card width (208px) + gap (16px)
            container.scrollBy({
                left: scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <section className="w-full py-12 px-4 bg-white">
            {/* Decorative Flower */}
            <div className="z-9999 absolute right-0 top-300 w-64 h-64  pointer-events-none">
                <Image
                    src="/assets/images/flowerFloated.svg"
                    alt="Decorative flower"
                    fill
                    className="object-contain"
                />
            </div>

            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-[#2b1a16] mb-2">
                        Featured Categories
                    </h2>
                    <p className="text-gray-500 text-sm">
                        Browse through some of our most popular categories
                    </p>
                </div>

                {/* Carousel Container */}
                <div className="relative">
                    {/* Categories Grid */}
                    <div
                        ref={scrollContainerRef}
                        className="overflow-x-auto scrollbar-hide"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {!mounted || categories.length === 0 ? (
                            <div className="flex gap-4 pb-4">
                                {/* Loading skeleton */}
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={i} className="w-52 flex flex-col items-center">
                                        <div className="w-52 h-52 rounded-2xl bg-gray-200 animate-pulse mb-3" />
                                        <div className="w-32 h-4 bg-gray-200 animate-pulse rounded" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
                                {categories.map((category) => (
                                    <Link
                                        key={category.id}
                                        href={`/${locale}/products?category=${category.slug}`}
                                        className="group"
                                    >
                                        <div className="w-52 flex flex-col items-center">
                                            <div className="relative w-52 h-52 rounded-2xl overflow-hidden mb-3 shadow-md group-hover:shadow-xl transition-shadow">
                                                <Image
                                                    src={category.image_url || "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300"}
                                                    alt={category.name}
                                                    fill
                                                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                            </div>
                                            <h3 className="text-center font-medium text-[#2b1a16] text-sm group-hover:text-[#7a3b2e] transition">
                                                {category.name}
                                            </h3>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Navigation Buttons - Only show when mounted and has content */}
                    {mounted && categories.length > 0 && (
                        <>
                            {/* Previous Button */}
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

                            {/* Next Button */}
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
