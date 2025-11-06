import { useState } from 'react';

interface UseCarouselProps {
    totalItems: number;
    itemsPerSlide: number;
}

export function useCarousel({ totalItems, itemsPerSlide }: UseCarouselProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const totalSlides = Math.ceil(totalItems / itemsPerSlide);

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % totalSlides);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
    };

    const goToSlide = (index: number) => {
        setCurrentSlide(index);
    };

    const getCurrentItems = <T,>(items: T[]): T[] => {
        const start = currentSlide * itemsPerSlide;
        return items.slice(start, start + itemsPerSlide);
    };

    return {
        currentSlide,
        totalSlides,
        nextSlide,
        prevSlide,
        goToSlide,
        getCurrentItems,
    };
}

