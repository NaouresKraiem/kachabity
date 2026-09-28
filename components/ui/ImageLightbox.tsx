"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

interface LightboxImage {
    src: string;
    alt: string;
}

interface ImageLightboxProps {
    images: LightboxImage[];
    /** Index of the image shown in the trigger and opened first. */
    index: number;
    className?: string;
}

/** Product image that opens a full-screen, keyboard-navigable gallery on click. */
export default function ImageLightbox({ images, index, className = "" }: ImageLightboxProps) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const current = images[index] ?? images[0];

    const close = useCallback(() => setOpenIndex(null), []);
    const step = useCallback(
        (delta: number) => setOpenIndex((i) => (i === null ? i : (i + delta + images.length) % images.length)),
        [images.length]
    );

    useEffect(() => {
        if (openIndex === null) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
            if (e.key === "ArrowRight") step(1);
            if (e.key === "ArrowLeft") step(-1);
        };
        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [openIndex, close, step]);

    if (!current) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpenIndex(Math.max(0, images.indexOf(current)))}
                className={`group relative block w-full aspect-square overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 ${className}`}
            >
                <Image src={current.src} alt={current.alt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                    <span className="text-white text-sm font-medium">Click to view</span>
                </span>
            </button>

            {openIndex !== null && (
                <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90" onClick={close}>
                    <div className="relative h-[85vh] w-[90vw]" onClick={(e) => e.stopPropagation()}>
                        <Image src={images[openIndex].src} alt={images[openIndex].alt} fill sizes="90vw" className="object-contain" />
                    </div>
                    <button type="button" onClick={close} aria-label="Close" className="absolute top-4 right-4 text-3xl text-white/80 hover:text-white">×</button>
                    {images.length > 1 && (
                        <>
                            <button type="button" aria-label="Previous image" onClick={(e) => { e.stopPropagation(); step(-1); }} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-2 text-3xl text-white hover:bg-white/20">‹</button>
                            <button type="button" aria-label="Next image" onClick={(e) => { e.stopPropagation(); step(1); }} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-2 text-3xl text-white hover:bg-white/20">›</button>
                            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80">{openIndex + 1} / {images.length}</span>
                        </>
                    )}
                </div>
            )}
        </>
    );
}
