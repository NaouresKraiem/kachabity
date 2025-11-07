"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import supabase from '@/lib/supabaseClient';
import PromoProductCard from "./PromoProductCard";
import type { PromoProduct } from "@/types/product";

interface PromoProductsProps {
    locale?: string;
}

export default function PromoProducts({ locale = 'en' }: PromoProductsProps) {
    const [products, setProducts] = useState<PromoProduct[]>([]);
    const [categoryMap, setCategoryMap] = useState<Map<string, string>>(new Map());
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        async function fetchPromoProducts() {
            try {
                // Fetch categories first
                const { data: categoriesData, error: categoriesError } = await supabase
                    .from('categories')
                    .select('id, slug');

                if (!categoriesError && categoriesData) {
                    const map = new Map<string, string>(categoriesData.map((cat: { id: string; slug: string }) => [cat.id, cat.slug]));
                    setCategoryMap(map);
                }

                // Fetch products with active promotions
                // First try with promo_end_date column
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .not('discount_percent', 'is', null)
                    .gt('discount_percent', 0)
                    .limit(6);

                if (error) throw error;

                if (data && data.length > 0) {
                    // Add mock promo data if columns don't exist
                    const promoProducts = data.map((product: PromoProduct) => ({
                        ...product,
                        sold_count: product.sold_count,
                        promo_end_date: product.promo_end_date
                    }));
                    setProducts(promoProducts as PromoProduct[]);
                }
            } catch (error) {
                console.error('Error fetching promo products:', error);
            }
        }

        fetchPromoProducts();
    }, []);

    if (!mounted) {
        return null;
    }

    return (
        <section className="w-full py-16 px-4 bg-[#FAFAFA]">
            <div className="max-w-7xl 2xl:max-w-[1581px] mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold text-[#2b1a16] mb-2">
                        Promotional Products
                    </h2>
                    <p className="text-gray-500 text-sm mb-4">
                        Limited time offers on our best products
                    </p>
                    <Image
                        src="/assets/images/highlight.svg"
                        alt="Decorative"
                        height={100}
                        width={150}
                        className="mx-auto block"
                    />
                </div>

                {/* Products Slider */}
                {products.length === 0 ? (
                    <div className="flex gap-6 overflow-x-auto overflow-y-hidden pb-4 snap-x snap-mandatory scrollbar-hide">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white rounded-2xl border border-[#E3E3E3] overflow-hidden animate-pulse shrink-0 w-[90%] md:w-[45%] lg:w-[400px] xl:w-[490px] 2xl:w-[500px] snap-start">
                                <div className="h-64 bg-gray-200" />
                                <div className="p-6 space-y-4">
                                    <div className="h-6 bg-gray-200 rounded w-3/4" />
                                    <div className="h-8 bg-gray-200 rounded w-1/2" />
                                    <div className="h-4 bg-gray-200 rounded w-full" />
                                    <div className="h-12 bg-gray-200 rounded w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="flex gap-6 overflow-x-auto overflow-y-hidden pb-4 snap-x snap-mandatory scrollbar-hide">
                            {products.map((product) => {
                                const categorySlug = product.category_id
                                    ? categoryMap.get(product.category_id) || 'all'
                                    : 'all';

                                return (
                                    <div key={product.id} className="shrink-0 w-[90%] md:w-[45%] lg:w-[500px] xl:w-[490px] 2xl:w-[500px] snap-start">
                                        <PromoProductCard
                                            product={product}
                                            locale={locale}
                                            categorySlug={categorySlug}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Scroll Indicator */}
                        {products.length == 3 && (
                            <div className="flex justify-center items-center gap-2 mt-2 text-sm text-gray-500">
                                <svg className="w-5 h-5 animate-bounce-x" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                                <span>Scroll to see more</span>
                            </div>
                        )}
                    </>
                )}

                {products.length > 3 && (
                    <div className="text-center mt-4">
                        <Link
                            href={`/${locale}/products?promo=true`}
                            className="text-[#842E1B] font-medium hover:underline inline-flex items-center gap-2"
                        >
                            See All
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}

