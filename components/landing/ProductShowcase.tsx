import Image from "next/image";
import Link from "next/link";
import { isRTL } from "@/lib/language-utils";
import { reemKufi } from "@/lib/fonts";
import type { LandingProduct } from "@/lib/landing-products";

const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || "TND";

const translations = {
    en: {
        title: "Kachabia, burnous and dengri, made in Tunisia",
        intro: "Wool pieces woven by Tunisian artisans and delivered to your door. You pay when your order arrives.",
        shopCollection: "Shop the collection",
        allProducts: "See all products",
        cashOnDelivery: "Cash on delivery",
        freeDelivery: (amount: number) => `Free delivery from ${amount} ${CURRENCY}`,
    },
    fr: {
        title: "Kachabia, burnous et dengri, faits en Tunisie",
        intro: "Des pièces en laine tissées par des artisans tunisiens et livrées chez vous. Vous payez à la réception de votre commande.",
        shopCollection: "Voir la collection",
        allProducts: "Tous les produits",
        cashOnDelivery: "Paiement à la livraison",
        freeDelivery: (amount: number) => `Livraison offerte dès ${amount} ${CURRENCY}`,
    },
    ar: {
        title: "قشابية، برنوس ودنقري، صُنعت في تونس",
        intro: "قطع من الصوف ينسجها حرفيون تونسيون وتصلك إلى باب منزلك. تدفع عند استلام طلبك.",
        shopCollection: "تسوّق المجموعة",
        allProducts: "كل المنتجات",
        cashOnDelivery: "الدفع عند الاستلام",
        freeDelivery: (amount: number) => `توصيل مجاني ابتداءً من ${amount} ${CURRENCY}`,
    },
};

interface ProductShowcaseProps {
    locale: string;
    products: LandingProduct[];
    collectionSlug: string | null;
    freeShippingThreshold: number | null;
}

function PhotoTile({
    product,
    locale,
    className,
    sizes,
    delay,
    priority,
}: {
    product: LandingProduct;
    locale: string;
    className: string;
    sizes: string;
    delay: number;
    priority?: boolean;
}) {
    return (
        <Link
            href={`/${locale}/products/${product.slug}`}
            className={`landing-reveal group relative block overflow-hidden rounded-[14px] bg-[#f3efe9] outline-none focus-visible:ring-2 focus-visible:ring-[var(--wool-maroon)] focus-visible:ring-offset-4 ${className}`}
            style={{ animationDelay: `${delay}ms` }}
        >
            {product.image && (
                <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes={sizes}
                    priority={priority}
                    className="object-cover object-top"
                />
            )}
            <span className="absolute bottom-2 start-2 end-2 flex flex-col gap-0.5 rounded-[10px] bg-white/92 px-3 py-2 text-xs backdrop-blur sm:bottom-3 sm:start-3 sm:end-3 sm:text-sm">
                <span className="line-clamp-2 font-medium text-[var(--wool-ink)] group-hover:underline underline-offset-4">
                    {product.name}
                </span>
                <span className="shrink-0 font-semibold text-[var(--wool-maroon)]" dir="ltr">
                    {product.price} {CURRENCY}
                </span>
            </span>
        </Link>
    );
}

// Three signature pieces (kachabia, dengri, burnous) with the store's ordering terms.
export default function ProductShowcase({ locale, products, collectionSlug, freeShippingThreshold }: ProductShowcaseProps) {
    const t = translations[locale as keyof typeof translations] || translations.en;
    if (products.length === 0) return null;
    const [main, second, third] = products;
    const collectionHref = collectionSlug
        ? `/${locale}/products?category=${collectionSlug}`
        : `/${locale}/products`;

    return (
        <section dir={isRTL(locale) ? "rtl" : "ltr"} className={`${reemKufi.variable} w-full bg-white`}>
            <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-8 pb-12 lg:pt-12 lg:pb-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-14">
                <div className="landing-fade max-w-xl text-start">
                    <h1 className="font-[family-name:var(--font-kufi)] text-3xl font-bold leading-[1.15] text-[var(--wool-ink)] sm:text-4xl lg:text-5xl">
                        {t.title}
                    </h1>
                    <p className="mt-5 max-w-md text-base leading-relaxed text-[#5b4a42] sm:text-lg">
                        {t.intro}
                    </p>

                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link
                            href={collectionHref}
                            className="rounded-full bg-[var(--wool-maroon)] px-6 py-3 font-medium text-white transition-colors hover:bg-[#6b2516] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--wool-maroon)]"
                        >
                            {t.shopCollection}
                        </Link>
                        <Link
                            href={`/${locale}/products`}
                            className="rounded-full border border-[var(--wool-ink)]/25 px-6 py-3 font-medium text-[var(--wool-ink)] transition-colors hover:border-[var(--wool-ink)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--wool-maroon)]"
                        >
                            {t.allProducts}
                        </Link>
                    </div>

                    <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#5b4a42]">
                        <li className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-[var(--wool-camel)]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                <rect x="2" y="5" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
                                <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6" />
                            </svg>
                            {t.cashOnDelivery}
                        </li>
                        {freeShippingThreshold !== null && (
                            <li className="flex items-center gap-2">
                                <svg className="h-4 w-4 text-[var(--wool-camel)]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                    <path d="M2 5h10v8H2zM12 8h3.5L18 10.5V13h-6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                                    <circle cx="5.5" cy="14.5" r="1.5" fill="currentColor" />
                                    <circle cx="14.5" cy="14.5" r="1.5" fill="currentColor" />
                                </svg>
                                {t.freeDelivery(freeShippingThreshold)}
                            </li>
                        )}
                    </ul>
                </div>

                {main && (
                    <div className="grid h-[320px] auto-cols-fr grid-flow-col gap-2 sm:h-[440px] sm:gap-3 lg:h-[460px] lg:gap-4">
                        <PhotoTile
                            product={main}
                            locale={locale}
                            className=""
                            sizes="(max-width: 1024px) 33vw, 240px"
                            delay={100}
                            priority
                        />
                        {second && (
                            <PhotoTile
                                product={second}
                                locale={locale}
                                className=""
                                sizes="(max-width: 1024px) 33vw, 240px"
                                delay={250}
                            />
                        )}
                        {third && (
                            <PhotoTile
                                product={third}
                                locale={locale}
                                className=""
                                sizes="(max-width: 1024px) 33vw, 240px"
                                delay={400}
                            />
                        )}
                    </div>
                )}
            </div>
            <div className="woven-band" aria-hidden="true" />
        </section>
    );
}
