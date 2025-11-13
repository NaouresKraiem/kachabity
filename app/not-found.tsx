"use client";

import { Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import StaticHeader from "@/components/layout/StaticHeader";
import Footer from "@/components/footer/Footer";
import Image from "next/image";
import { headerConfig } from "@/lib/config";
import { defaultLanguage } from "@/lib/language-utils";

export default function RootNotFound() {
    const router = useRouter();
    const pathname = usePathname();

    // Extract locale from pathname or use default
    const locale = pathname?.split('/')[1] || defaultLanguage;

    return (
        <>
            <Suspense fallback={<div className="h-20" />}>
                <StaticHeader locale={locale} />
            </Suspense>

            <div className="min-h-screen bg-white flex items-center justify-center px-4 py-16">
                <div className="max-w-2xl w-full text-center">
                    {/* 404 SVG Image */}
                    <div className="mb-8">
                        <Image
                            src="/404.svg"
                            alt="404 Not Found"
                            width={500}
                            height={350}
                            className="mx-auto"
                            priority
                        />
                    </div>

                    {/* Oops! Message */}
                    <h1 className="text-5xl font-bold text-gray-900 mb-4">
                        Oops!
                    </h1>

                    {/* Description */}
                    <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
                        We can&apos;t seem to find the page you are looking for
                    </p>

                    {/* Back to Homepage Button */}
                    <button
                        onClick={() => router.push(`/${locale}`)}
                        className="inline-block px-8 py-4 bg-[#7a3b2e] text-white text-lg font-medium rounded-lg hover:bg-[#5e2d23] transition-colors shadow-lg hover:shadow-xl"
                    >
                        Back To Homepage
                    </button>

                    {/* Follow us section */}
                    <div className="mt-16 ">
                        <p className="text-gray-600 mb-6 font-medium">Follow us on</p>

                        <div className="flex space-x-2 items-center justify-center">
                            {Object.entries(headerConfig.social).map(([platform, data]) => (

                                <a
                                    key={platform}
                                    href={data.url}
                                    target="_blank"
                                    rel="noopener noreferrer"

                                    className="w-14 h-14 rounded-full bg-[#f5f5f5] hover:bg-[#7a3b2e] flex items-center justify-center transition-colors group"

                                    aria-label={`Follow us on ${platform}`}
                                >
                                    <svg className="w-6 h-6 text-[#7a3b2e] group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                                        <path d={data.icon} />
                                    </svg>
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <Footer />
        </>
    );
}

