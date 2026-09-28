import Link from "next/link";
import { isRTL } from "@/lib/language-utils";
import { reemKufi } from "@/lib/fonts";
import type { SpotlightCollection } from "@/lib/landing-products";
import LandingProductCard from "./LandingProductCard";

const translations = {
    en: {
        count: (n: number) => `${n} pieces in this collection, the largest in our shop. Pick a style:`,
        viewCollection: "Shop the whole collection",
    },
    fr: {
        count: (n: number) => `${n} pièces dans cette collection, la plus complète de la boutique. Choisissez un style :`,
        viewCollection: "Voir toute la collection",
    },
    ar: {
        count: (n: number) => `${n} قطعة في هذه المجموعة، الأكبر في متجرنا. اختر الطراز:`,
        viewCollection: "تسوّق المجموعة كاملة",
    },
};

interface CollectionSpotlightProps {
    locale: string;
    collection: SpotlightCollection | null;
}

export default function CollectionSpotlight({ locale, collection }: CollectionSpotlightProps) {
    if (!collection || collection.products.length < 3) return null;
    const t = translations[locale as keyof typeof translations] || translations.en;
    const categoryHref = (slug: string) => `/${locale}/products?category=${slug}`;

    return (
        <section
            dir={isRTL(locale) ? "rtl" : "ltr"}
            className={`${reemKufi.variable} w-full bg-[var(--wool-brown)] text-[var(--wool-undyed)]`}
        >
            <div className="woven-band" aria-hidden="true" />
            <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:gap-12 lg:py-20">
                <div className="text-start lg:pt-4">
                    <h2 className="font-[family-name:var(--font-kufi)] text-5xl font-bold leading-none text-[var(--wool-undyed)] sm:text-6xl">
                        {collection.name}
                    </h2>
                    <p className="mt-5 max-w-xs leading-relaxed text-[var(--wool-undyed)]/75">
                        {t.count(collection.productCount)}
                    </p>

                    {collection.subcategories.length > 0 && (
                        <ul className="mt-5 flex flex-wrap gap-2">
                            {collection.subcategories.map((sub) => (
                                <li key={sub.slug}>
                                    <Link
                                        href={categoryHref(sub.slug)}
                                        className="block rounded-full border border-[var(--wool-undyed)]/35 px-3.5 py-1.5 text-sm transition-colors hover:border-[var(--wool-undyed)] hover:bg-[var(--wool-undyed)] hover:text-[var(--wool-brown)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wool-undyed)]"
                                    >
                                        {sub.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}

                    <Link
                        href={categoryHref(collection.slug)}
                        className="mt-8 inline-block rounded-full bg-[var(--wool-undyed)] px-6 py-3 font-medium text-[var(--wool-brown)] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--wool-undyed)]"
                    >
                        {t.viewCollection}
                    </Link>
                </div>

                <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-color:rgba(233,225,211,0.35)_transparent] [scrollbar-width:thin] lg:mx-0 lg:px-0">
                    <ul className="flex snap-x snap-mandatory gap-4 lg:gap-5">
                        {collection.products.map((product) => (
                            <li key={product.id} className="w-[60vw] max-w-[240px] shrink-0 snap-start sm:w-60">
                                <LandingProductCard
                                    product={product}
                                    locale={locale}
                                    tone="dark"
                                    sizes="240px"
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className="woven-band" aria-hidden="true" />
        </section>
    );
}
