"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import CountdownTimer from "../timers/CountdownTimer";
import supabase from '@/lib/supabaseClient';

interface Promotion {
    id: string;
    title: string;
    subtitle: string | null;
    badge_text: string | null;
    discount_percent: number;
    image_url: string;
    starts_at: string;
    ends_at: string;
    active: boolean;
}

export default function SaleBanner() {
    const [promotion, setPromotion] = useState<Promotion | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        async function fetchPromotion() {
            try {
                const { data, error } = await supabase
                    .from('promotions')
                    .select('*')
                    .eq('active', true)
                    .gte('ends_at', new Date().toISOString())
                    .order('discount_percent', { ascending: false })
                    .limit(1)
                    .single();

                if (error) throw error;
                if (data) {
                    setPromotion(data);
                }
            } catch (error) {
                console.error('Error fetching promotion:', error);
            }
        }

        fetchPromotion();
    }, []);

    if (!mounted || !promotion) {
        return null;
    }

    const saleEndDate = new Date(promotion.ends_at);

    return (
        <section className="w-full py-1 px-2 bg-[#ECE5DD] h-[400px]">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col lg:flex-row items-center gap-12">
                    {/* Left Content */}
                    <div className="flex-1 text-center lg:text-center">
                        <h2 className="text-5xl lg:text-6xl font-bold text-[#2b1a16] mb-4">
                            {promotion.title}
                            {promotion.discount_percent > 0 && (
                                <span className="text-[#842E1B]"> {promotion.discount_percent}%</span>
                            )}
                        </h2>

                        {promotion.subtitle && (
                            <p className=" text-gray-600 text-[16px] font-normal max-w-lg mb-8 mx-auto lg:mx-0">
                                {promotion.subtitle}
                            </p>
                        )}

                        <div className="mb-8 flex justify-center lg:justify-center">
                            <CountdownTimer targetDate={saleEndDate} />
                        </div>

                        <Link
                            href="/products"
                            className="inline-block bg-[#842E1B] text-white px-12 py-4 rounded-[9px] text-lg font-semibold hover:bg-[#6b2516] transition-colors uppercase"
                        >
                            Shop Now
                        </Link>
                    </div>

                    <div className="flex-1 relative w-full h-[360px] lg:h-[360px]">
                        <Image
                            src={promotion.image_url}
                            alt={promotion.title}
                            fill
                            className="object-contain"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}


