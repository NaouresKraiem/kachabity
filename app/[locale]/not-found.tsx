"use client";

import { Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import StaticHeader from "@/components/layout/StaticHeader";
import Footer from "@/components/footer/Footer";
import Image from "next/image";
import { headerConfig } from "@/lib/config";

const content = {
    en: {
        oops: "Oops!",
        message: "We can't seem to find the page you are looking for",
        backButton: "Back To Homepage"
    },
    fr: {
        oops: "Oups!",
        message: "Nous ne trouvons pas la page que vous recherchez",
        backButton: "Retour à l'accueil"
    },
    ar: {
        oops: "عذراً!",
        message: "لا يمكننا العثور على الصفحة التي تبحث عنها",
        backButton: "العودة إلى الصفحة الرئيسية"
    }
};

export default function NotFound() {
    const router = useRouter();
    const pathname = usePathname();

    // Extract locale from pathname (e.g., /en/something -> "en")
    const locale = pathname?.split('/')[1] || 'en';
    const validLocale = ['en', 'fr', 'ar'].includes(locale) ? locale : 'en';

    const text = content[validLocale as keyof typeof content] || content.en;

    return (
        <>
            <Suspense fallback={<div className="h-20" />}>
                <StaticHeader />
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
                        {text.oops}
                    </h1>

                    {/* Description */}
                    <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
                        {text.message}
                    </p>

                    {/* Back to Homepage Button */}
                    <button
                        onClick={() => router.push(`/${validLocale}`)}
                        className="inline-block px-8 py-4 bg-[#7a3b2e] text-white text-lg font-medium rounded-lg hover:bg-[#5e2d23] transition-colors shadow-lg hover:shadow-xl"
                    >
                        {text.backButton}
                    </button>

                    {/* Follow us section */}
                    <div className="mt-16">
                        <p className="text-gray-600 mb-6 font-medium">Follow us on</p>



                        <div className="flex space-x-2 items-center justify-center">
                            {Object.entries(headerConfig.social).map(([platform, data]) => (
                                <a
                                    key={platform}
                                    href={data.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-gray-300"
                                    aria-label={`Follow us on ${platform}`}
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
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

