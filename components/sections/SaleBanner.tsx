"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import CountdownTimer from "../timers/CountdownTimer";
import supabase from '@/lib/supabaseClient';
import { useParams } from "next/navigation";

const translations = {
    en: {
        shopNow: "Shop Now"
    },
    fr: {
        shopNow: "Acheter maintenant"
    },
    ar: {
        shopNow: "تسوق الآن"
    }
};

interface Promotion {
    id: string;
    title: string;
    subtitle: string | null;
    badge_text: string | null;
    discount_percent: number;
    image_url: string;
    starts_at: string | null;
    ends_at: string | null;
    active: boolean;
}

export default function SaleBanner() {
    const params = useParams();
    const locale = (params?.locale as string) || 'en';
    const t = translations[locale as keyof typeof translations] || translations.en;
    const [promotion, setPromotion] = useState<Promotion | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        async function fetchPromotion() {
            try {
                const now = new Date().toISOString();

                // Fetch active promotions
                const { data, error } = await supabase
                    .from('promotions')
                    .select('*')
                    .eq('active', true)
                    .order('discount_percent', { ascending: false });

                if (error) {
                    console.error('Error fetching promotion:', error);
                    return;
                }

                if (data && data.length > 0) {
                    // Filter promotions that are currently valid
                    const validPromotions = data.filter((promo: Promotion) => {
                        // No end date = always valid
                        if (!promo.ends_at) return true;

                        // Has end date = check if not expired
                        return new Date(promo.ends_at) >= new Date(now);
                    });

                    // Also filter by start date if provided
                    const activePromotions = validPromotions.filter((promo: Promotion) => {
                        // No start date = started immediately
                        if (!promo.starts_at) return true;

                        // Has start date = check if already started
                        return new Date(promo.starts_at) <= new Date(now);
                    });

                    // Prioritize: First show timed promotions (with end date), then ongoing ones
                    const timedPromotions = activePromotions.filter((promo: Promotion) =>
                        promo.ends_at && new Date(promo.ends_at) > new Date(now)
                    );

                    const ongoingPromotions = activePromotions.filter((promo: Promotion) => !promo.ends_at);

                    // Show timed promotion if available, otherwise show ongoing
                    if (timedPromotions.length > 0) {
                        setPromotion(timedPromotions[0]);
                    } else if (ongoingPromotions.length > 0) {
                        setPromotion(ongoingPromotions[0]);
                    }
                }
            } catch (error) {
                console.error('Error fetching promotion:', error);
            }
        }

        fetchPromotion();
    }, []);

    if (!mounted) {
        return null;
    }

    // If no timed promotion exists, don't show anything
    if (!promotion) {
        return null;
    }

    const hasEndDate = promotion.ends_at && new Date(promotion.ends_at) > new Date();

    // If promotion has no end date, don't show anything
    if (!hasEndDate) {
        return null;
    }

    // Show countdown banner for timed promotions
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

                        {/* Countdown timer (always shown here since hasEndDate is true) */}
                        <div className="mb-8 flex justify-center lg:justify-center">
                            <CountdownTimer targetDate={new Date(promotion.ends_at!)} />
                        </div>

                        <Link
                            href={`/${locale}/products`}
                            className="inline-block bg-[#842E1B] text-white px-12 py-4 rounded-[9px] text-lg font-semibold hover:bg-[#6b2516] transition-colors uppercase"
                        >
                            {t.shopNow}
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


