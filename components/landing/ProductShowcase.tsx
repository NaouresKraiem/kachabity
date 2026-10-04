import Image from "next/image";
import Link from "next/link";
import ProductRing3D from "./ProductRing3D";
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
        freeDelivery: (amount: number) => `Free delivery above ${amount} ${CURRENCY}`,
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
        freeDelivery: (amount: number) => `توصيل مجاني للطلبات التي تتجاوز ${amount} ${CURRENCY}`,
    },
};

interface ProductShowcaseProps {
    /** Products for the 3D ring (the showcase pieces first); falls back to the photo tiles. */
    ringProducts: LandingProduct[];
    locale: string;
    products: LandingProduct[];
    collectionSlug: string | null;
    freeShippingThreshold: number | null;
}

// Static background shown until the 3D ring is ready, and instead of it when 3D is off:
// the showcase photos side by side, full bleed.
function StaticBackdrop({ products }: { products: LandingProduct[] }) {
    return (
        <div className="grid h-full w-full auto-cols-fr grid-flow-col">
            {products.map((product, index) =>
                product.image ? (
                    <div key={product.id} className="relative h-full">
                        <Image
                            src={product.image}
                            alt=""
                            fill
                            sizes="(max-width: 1024px) 34vw, 480px"
                            priority={index === 0}
                            className="object-cover object-top"
                        />
                    </div>
                ) : null
            )}
        </div>
    );
}

// Full-width header: the product ring is the background, and the heading, text and
// buttons sit on top of it. The scrim keeps the text readable over the photos.
export default function ProductShowcase({ locale, products, ringProducts, collectionSlug, freeShippingThreshold }: ProductShowcaseProps) {
    const t = translations[locale as keyof typeof translations] || translations.en;
    if (products.length === 0) return null;
    const rtl = isRTL(locale);
    const collectionHref = collectionSlug
        ? `/${locale}/products?category=${collectionSlug}`
        : `/${locale}/products`;

    return (
        <section
            dir={rtl ? "rtl" : "ltr"}
            className={`${reemKufi.variable} relative isolate w-full overflow-hidden bg-[var(--wool-brown)] text-[var(--wool-undyed)]`}
        >
            <ProductRing3D locale={locale} products={ringProducts} className="absolute inset-0">
                <StaticBackdrop products={products} />
            </ProductRing3D>

            {/* Scrim: from the text side on wide screens, from the top on phones. */}
            <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 z-[1] bg-linear-to-b from-[var(--wool-brown)] via-[var(--wool-brown)]/70 to-transparent to-60% lg:via-[var(--wool-brown)]/75 lg:to-transparent lg:to-65% ${
                    rtl ? "lg:bg-linear-to-l" : "lg:bg-linear-to-r"
                }`}
            />

            <div className="pointer-events-none relative z-10 mx-auto flex min-h-[720px] max-w-7xl items-start px-4 pt-10 pb-28 lg:min-h-[min(84vh,760px)] lg:items-center lg:pt-16">
                <div className="landing-fade max-w-xl text-start">
                    <h1 className="font-[family-name:var(--font-kufi)] text-3xl font-bold leading-[1.15] text-white sm:text-4xl lg:text-[3.4rem]">
                        {t.title}
                    </h1>
                    <p className="mt-5 max-w-md text-base leading-relaxed text-[var(--wool-undyed)]/85 sm:text-lg">
                        {t.intro}
                    </p>

                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link
                            href={collectionHref}
                            className="pointer-events-auto rounded-full bg-[var(--wool-undyed)] px-6 py-3 font-medium text-[var(--wool-brown)] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--wool-undyed)]"
                        >
                            {t.shopCollection}
                        </Link>
                        <Link
                            href={`/${locale}/products`}
                            className="pointer-events-auto rounded-full border border-[var(--wool-undyed)]/40 bg-[var(--wool-brown)]/30 px-6 py-3 font-medium text-[var(--wool-undyed)] backdrop-blur-sm transition-colors hover:border-[var(--wool-undyed)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--wool-undyed)]"
                        >
                            {t.allProducts}
                        </Link>
                    </div>

                    <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--wool-undyed)]/80">
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
            </div>
            <div className="woven-band relative z-10" aria-hidden="true" />
        </section>
    );
}
