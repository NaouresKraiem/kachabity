"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type HeroData = {
    id: string;
    title: string;
    subtitle?: string;
    sub_subtitle?: string;
    left_image_url?: string;
    cta_label?: string;
    cta_href?: string;
    image_url?: string;
    is_active: boolean;
    sort_order: number;
};

type SmallCardData = {
    id: string;
    title: string;
    subtitle: string;
    image_url: string;
    bg_color: string;
    is_active: boolean;
    sort_order: number;
};

type HeroSectionProps = {
    heroData: HeroData[];
    smallCardsData: SmallCardData[];
};

export default function HeroSection({ heroData, smallCardsData }: HeroSectionProps) {
    console.log('heroData', heroData)
    const router = useRouter()
    const [currentSlide, setCurrentSlide] = useState(0);
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch by only rendering carousel after mount
    useEffect(() => {
        setMounted(true);
    }, []);

    const carouselSlides = heroData.length > 0 && heroData[0] ? heroData : [];
    const currentSlideData = carouselSlides[currentSlide];


    // useEffect(() => {
    //     if (!mounted || carouselSlides.length === 0) return;

    //     const interval = setInterval(() => {
    //         setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    //     }, 5000);
    //     return () => clearInterval(interval);
    // }, [carouselSlides.length, mounted]);

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length);
    };

    const goToSlide = (index: number) => {
        setCurrentSlide(index);
    };


    const leftCard = heroData[1]
   

    const rightCards = [
        {
            title: "Big deal Kachabia",
            subtitle: "Buy 1 Get 1",
            cta_label: "Buy Now",
            cta_href: "#products",
            image_url: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400",
            bgColor: "bg-pink-100"
        },
        {
            title: "New Item Name",
            subtitle: "Home Accesoire",
            cta_label: "Shop Now",
            cta_href: "#products",
            image_url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400",
            bgColor: "bg-green-100"
        },

    ];

    return (
        <section className="w-full py-8 px-4" aria-label="Featured Products">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-2">
                        <div className="bg-[#ACDEE6] rounded-2xl px-3 py-9  h-[500px] flex flex-col justify-between items-center">
                            <div className='justify-between items-center flex flex-col align-baseline'>

                                <div className="text-sm  font-medium mb-2">Where</div>
                                <div className="text-[16px] font-bold text-black mb-2">Tradition</div>
                                <div className="text-[16px] font-semimedium text-black mb-2">Meets</div>
                                <div className="text-[16px] font-medium text-black mb-2">Elegance</div>

                                {/* <h3 className="text-[20px] font-semibold text-[#000000] mb-4">{leftCard.subtitle}</h3> */}

                            </div>
                            <div className="flex justify-center">
                                <div className="relative w-32 h-32">
                                    <Image
                                        src={leftCard.left_image_url || "/vercel.svg"}
                                        alt={`${leftCard.title} - Premium handcrafted traditional product`}
                                        fill
                                        className="object-cover rounded-lg"
                                    />
                                </div>
                            </div>
                            <button onClick={() => router.push('/products')} className="bg-white cursor-pointer text-[#2b1a16] px-2 py-2 rounded-[8px] text-sm font-medium hover:bg-gray-50 transition">
                                {leftCard.cta_label}
                            </button>
                        </div>
                    </div>
                    <div className="lg:col-span-7 relative">
                        <div className="relative rounded-2xl overflow-hidden h-[350px]">
                            {/* Background Image */}
                            <div className="absolute inset-0">
                                <Image
                                    src={currentSlideData?.image_url || "/assets/images/hero-bg.jpg"}
                                    alt="Background"
                                    fill
                                    className="object-cover"
                                    priority
                                />
                                {/* Overlay for better text readability */}
                                <div className="absolute inset-0 bg-linear-to-r from-[#F4D3C6]/95 via-[#F4D3C6]/60 to-transparent"></div>
                            </div>

                            {!mounted || !currentSlideData ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-gray-400">Loading...</div>
                                </div>
                            ) : (
                                <div className="absolute inset-0 flex items-center p-8 pb-0">
                                    <div className="flex-1 z-10">
                                        <div className="text-sm text-[#000000] font-medium mb-2">{currentSlideData.title}</div>
                                        <h1 className="text-[36px]  font-semibold text-[#000000] mb-2">
                                            {currentSlideData.subtitle}
                                        </h1>
                                        <div className="text-sm text-[#000000] font-medium mb-5">{currentSlideData.sub_subtitle}</div>

                                        <button
                                            onClick={() => router.push(currentSlideData.cta_href || '/products')}
                                            className="bg-[#7a3b2e] text-white px-3 py-2 rounded-[8px] border border-black text-lg font-medium hover:bg-[#5e2d23] transition cursor-pointer"
                                        >
                                            {currentSlideData.cta_label}
                                        </button>
                                    </div>
                                    <div className="flex-1 flex justify-end items-end">
                                        <div className="relative w-[300px] h-[350px]">
                                            <Image
                                                src={currentSlideData.image_url || "/vercel.svg"}
                                                alt={`${currentSlideData.subtitle} - Premium handcrafted traditional product`}
                                                fill
                                                className="object-contain object-bottom"
                                                priority
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                            {mounted && carouselSlides.length > 0 && (
                                <>
                                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2">
                                        {carouselSlides.map((_, index) => (
                                            <button
                                                key={index}
                                                onClick={() => goToSlide(index)}
                                                className={`w-2 h-2 rounded-full transition ${index === currentSlide ? 'bg-white' : 'bg-gray-300'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        onClick={prevSlide}
                                        className="cursor-pointer absolute right-16 top-6    p-2 transition"
                                    >
                                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={nextSlide}
                                        className="cursor-pointer absolute right-6 top-6    p-2 transition"
                                    >
                                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </>
                            )}


                        </div>

                        {/* Small Cards Under Carousel */}
                        <div className="mt-6 grid grid-cols-3 gap-4">
                            {smallCardsData.slice(0, 3).map((card) => (
                                <div key={card.id} className={`${card.bg_color} rounded-2xl p-4 h-32 flex flex-col justify-between hover:shadow-md transition`}>
                                    <div className="flex-1 flex flex-col justify-center">
                                        <h3 className="text-sm font-bold text-[#2b1a16] mb-1">
                                            {card.title}
                                        </h3>
                                        <p className="text-[#6b4e45] text-xs">
                                            {card.subtitle}
                                        </p>
                                    </div>
                                    <div className="flex justify-center">
                                        <div className="relative w-12 h-12">
                                            <Image
                                                src={card.image_url}
                                                alt={card.title}
                                                fill
                                                className="object-cover rounded-lg"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="lg:col-span-3 space-y-4">
                        {rightCards.map((card, index) => (
                            <div key={index} className={`${card.bgColor} rounded-2xl p-6 h-[167px] flex items-center`}>
                                <div className="flex-1">
                                    <div className="text-sm text-[#7a3b2e] font-medium mb-1">
                                        {index === 0 ? "Big deal" : "New"}
                                    </div>
                                    <h3 className="text-lg font-bold text-[#2b1a16] mb-2">
                                        {card.title}
                                    </h3>
                                    <p className="text-[#6b4e45] mb-4 text-sm">
                                        {card.subtitle}
                                    </p>

                                </div>
                                <div className="w-20 h-20 relative">
                                    <Image
                                        src={card.image_url}
                                        alt={card.title}
                                        fill
                                        className="object-cover rounded-lg"
                                    />
                                </div>
                            </div>
                        ))}
                        <div className="grid grid-cols-2 gap-4 h-[167px]">
                            {smallCardsData.slice(3, 5).map((card) => (
                                <div key={card.id} className={`${card.bg_color} rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition h-32`}>
                                    <div className="flex-1 flex flex-col justify-center">
                                        <h3 className="text-lg font-bold text-[#2b1a16] mb-1">
                                            {card.title}
                                        </h3>
                                        <p className="text-[#6b4e45] text-sm">
                                            {card.subtitle}
                                        </p>
                                    </div>
                                    <div className="flex justify-center">
                                        <div className="relative w-12 h-12">
                                            <Image
                                                src={card.image_url}
                                                alt={card.title}
                                                fill
                                                className="object-cover rounded-lg"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                        </div>

                    </div>

                </div>
            </div>
        </section>
    );
}
