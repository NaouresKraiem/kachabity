import Image from "next/image";
import Link from "next/link";
import type { LandingProduct } from "@/lib/landing-products";

const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || "TND";

interface LandingProductCardProps {
    product: LandingProduct;
    locale: string;
    tone?: "light" | "dark";
    sizes: string;
}

// Image-led product card: portrait photo, name, category and price.
export default function LandingProductCard({
    product,
    locale,
    tone = "light",
    sizes,
}: LandingProductCardProps) {
    const dark = tone === "dark";

    return (
        <Link
            href={`/${locale}/products/${product.slug}`}
            className={`group flex h-full flex-col rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-offset-4 ${
                dark
                    ? "focus-visible:ring-[var(--wool-undyed)] focus-visible:ring-offset-[var(--wool-brown)]"
                    : "focus-visible:ring-[var(--wool-maroon)]"
            }`}
        >
            <div
                className={`relative w-full overflow-hidden rounded-[12px] aspect-[3/4] ${dark ? "bg-[#4a372c]" : "bg-[#f3efe9]"}`}
            >
                {product.image && (
                    <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        sizes={sizes}
                        className="object-cover object-top"
                    />
                )}
                {product.discountPercent > 0 && (
                    <span className="absolute top-3 start-3 rounded-full bg-[var(--wool-maroon)] px-2.5 py-1 text-xs font-semibold text-white">
                        -{product.discountPercent}%
                    </span>
                )}
            </div>

            <div className="pt-3">
                {product.categoryName && (
                    <p className={`text-xs ${dark ? "text-[var(--wool-undyed)]/60" : "text-[#8a7a70]"}`}>
                        {product.categoryName}
                    </p>
                )}
                <h3
                    className={`mt-0.5 line-clamp-2 font-medium leading-snug group-hover:underline underline-offset-4 text-[15px] ${dark ? "text-[var(--wool-undyed)]" : "text-[var(--wool-ink)]"}`}
                >
                    {product.name}
                </h3>
                <p className="mt-1.5 flex items-baseline gap-2" dir="ltr">
                    <span className={`font-semibold ${dark ? "text-white" : "text-[var(--wool-maroon)]"}`}>
                        {product.price} {CURRENCY}
                    </span>
                    {product.originalPrice !== null && (
                        <span className={`text-sm line-through ${dark ? "text-white/45" : "text-[#a3958c]"}`}>
                            {product.originalPrice} {CURRENCY}
                        </span>
                    )}
                </p>
            </div>
        </Link>
    );
}
