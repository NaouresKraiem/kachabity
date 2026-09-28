import Link from "next/link";
import { isRTL } from "@/lib/language-utils";
import { reemKufi } from "@/lib/fonts";
import type { LandingProduct } from "@/lib/landing-products";
import LandingProductCard from "./LandingProductCard";

const translations = {
    en: {
        title: "New in the shop",
        subtitle: "The latest pieces we've added, photographed in our shop.",
        seeAll: "See all products",
    },
    fr: {
        title: "Nouveautés",
        subtitle: "Les dernières pièces arrivées, photographiées dans notre boutique.",
        seeAll: "Voir tous les produits",
    },
    ar: {
        title: "وصل حديثاً",
        subtitle: "آخر القطع التي أضفناها، مصوّرة في متجرنا.",
        seeAll: "عرض كل المنتجات",
    },
};

interface NewArrivalsProps {
    locale: string;
    products: LandingProduct[];
}

export default function NewArrivals({ locale, products }: NewArrivalsProps) {
    if (products.length < 3) return null;
    const t = translations[locale as keyof typeof translations] || translations.en;

    return (
        <section dir={isRTL(locale) ? "rtl" : "ltr"} className={`${reemKufi.variable} w-full bg-white px-4 py-16`}>
            <div className="mx-auto max-w-7xl">
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                    <div className="text-start">
                        <h2 className="font-[family-name:var(--font-kufi)] text-3xl font-bold text-[var(--wool-ink)] sm:text-4xl">
                            {t.title}
                        </h2>
                        <p className="mt-2 text-[#6f5f57]">{t.subtitle}</p>
                    </div>
                    <Link
                        href={`/${locale}/products`}
                        className="font-medium text-[var(--wool-maroon)] underline decoration-[var(--wool-maroon)]/30 underline-offset-4 hover:decoration-[var(--wool-maroon)]"
                    >
                        {t.seeAll}
                    </Link>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-5">
                    {products.map((product) => (
                        <LandingProductCard
                            key={product.id}
                            product={product}
                            locale={locale}
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 250px"
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
