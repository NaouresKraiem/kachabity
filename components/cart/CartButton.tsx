"use client";

import { useCart } from "@/lib/cart-context";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";

const translations = {
    en: {
        cart: "Cart",
        item: "item",
        items: "items"
    },
    fr: {
        cart: "Panier",
        item: "article",
        items: "articles"
    },
    ar: {
        cart: "السلة",
        item: "عنصر",
        items: "عناصر"
    }
};

export default function CartButton() {
    const router = useRouter();
    const pathname = usePathname();

    // Extract locale from pathname
    const locale = pathname?.split('/')[1] || 'en';
    const t = translations[locale as keyof typeof translations] || translations.en;

    // Try to use cart context, fallback to defaults if outside provider
    let totalItems = 0;
    let openCart = () => router.push(`/${locale}/cart`);

    try {
        const cartContext = useCart();
        totalItems = cartContext.totalItems;
        openCart = cartContext.openCart;
    } catch {
        // Outside CartProvider, use defaults
    }

    return (
        <button
            onClick={openCart}
            className="cursor-pointer flex items-center space-x-2 text-[#2b1a16] hover:text-[#7a3b2e] transition relative"
            aria-label="Shopping cart"
        >
            <div className="relative">
                <Image src="/assets/images/icons/addCart.svg" alt="cart" width={24} height={24} />
                {totalItems > 0 && (
                    <span className="absolute -top-2 -right-2 bg-[#842E1B] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {totalItems}
                    </span>
                )}
            </div>
            <span className="font-medium">{t.cart} </span>
        </button>
    );
}

