"use client";

import { useState, useEffect } from "react";
import supabase from '@/lib/supabaseClient';
import ReviewCard from './ReviewCard';
import ServiceHighlightCard from '../services/ServiceHighlightCard';
import SectionHeader from '../ui/SectionHeader';
import CarouselNavigation from '../carousel/CarouselNavigation';
import CarouselIndicators from '../carousel/CarouselIndicators';
import { useCarousel } from '@/hooks/useCarousel';
import { getServiceHighlights } from '@/lib/service-highlights';

interface User {
    id: string;
    name: string;
    email?: string;
    avatar_url?: string;
}

interface Review {
    id: string;
    user_id: string;
    rating: number;
    comment: string;
    created_at?: string;
    users?: User;
}

const ITEMS_PER_SLIDE = 3;
const MAX_REVIEWS = 9;

export default function CustomerFeedback() {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [mounted, setMounted] = useState(false);

    const {
        currentSlide,
        totalSlides,
        nextSlide,
        prevSlide,
        goToSlide,
        getCurrentItems
    } = useCarousel({
        totalItems: reviews.length,
        itemsPerSlide: ITEMS_PER_SLIDE
    });

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        async function fetchReviews() {
            try {
                const { data, error } = await supabase
                    .from('reviews')
                    .select(`
                        *,
                        users:user_id (
                            id,
                            name,
                            email,
                            avatar_url
                        )
                    `)
                    .order('updated_at', { ascending: false })
                    .limit(MAX_REVIEWS);

                if (error) throw error;
                if (data) {
                    setReviews(data);
                }
            } catch (error) {
                console.error('Error fetching reviews:', error);
            }
        }

        fetchReviews();
    }, []);

    if (!mounted) {
        return null;
    }

    const serviceHighlights = getServiceHighlights();
    const currentReviews = getCurrentItems(reviews);


    return (
        <section className="w-full py-16 px-4 bg-[#F5F5F5]">
            <div className="max-w-7xl mx-auto">
                <SectionHeader
                    title="Our Customer Feedback"
                    subtitle="Don't take our word for it. Trust our customers"
                />

                {reviews.length > ITEMS_PER_SLIDE && (
                    <CarouselNavigation
                        onPrevious={prevSlide}
                        onNext={nextSlide}
                    />
                )}

                {/* Reviews Carousel */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {currentReviews.map((review) => (
                        <ReviewCard key={review.id} review={review} />
                    ))}
                </div>

                {totalSlides > 1 && (
                    <CarouselIndicators
                        totalSlides={totalSlides}
                        currentSlide={currentSlide}
                        onSlideChange={goToSlide}
                    />
                )}

                {/* Service Highlights */}
                <div className="flex justify-center items-center gap-2 mt-12 mx-auto">
                    {serviceHighlights.map((highlight, index) => (
                        <ServiceHighlightCard
                            key={index}
                            icon={highlight.icon}
                            title={highlight.title}
                            description={highlight.description}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}

