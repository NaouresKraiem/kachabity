"use client";

import React, { useEffect } from "react";
import { useCart } from "@/lib/cart-context";
import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import { isRTL } from "@/lib/language-utils";
import { Divider } from "antd";
import CartItem from "./CartItem";

const content = {
    en: {
        myCart: "My card",
        reviews: "reviews",
        subtotal: "Subtotal",
        checkout: "checkout",
        viewCart: "View Cart",
        emptyCart: "Your cart is empty",
        startShopping: "Start Shopping"
    },
    fr: {
        myCart: "Mon Panier",
        reviews: "avis",
        subtotal: "Sous-total",
        checkout: "commander",
        viewCart: "Voir le Panier",
        emptyCart: "Votre panier est vide",
        startShopping: "Commencer vos achats"
    },
    ar: {
        myCart: "سلتي",
        reviews: "تقييم",
        subtotal: "المجموع الفرعي",
        checkout: "الدفع",
        viewCart: "عرض السلة",
        emptyCart: "سلتك فارغة",
        startShopping: "ابدأ التسوق"
    }
};

export default function CartDrawer() {
    const { items, subtotal, updateQuantity, removeItem, isCartOpen, closeCart } = useCart();
console.log(items);
    const { locale } = useLanguage();
    const text = content[locale as keyof typeof content] || content.en;
    const rtl = isRTL(locale);

    useEffect(() => {
        if (typeof document === "undefined") return;

        if (isCartOpen) {
            const originalStyle = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = originalStyle;
            };
        }
    }, [isCartOpen]);

    if (!isCartOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 z-1500 bg-black/30 backdrop-blur-[2px]"
                onClick={closeCart}
            />
            <div className={`fixed ${rtl ? 'left-6' : 'right-6'} top-[110px] mt-2 w-full max-w-[500px] bg-white z-1510 shadow-2xl rounded-[12px] border border-gray-200 max-h-[calc(100vh-140px)] overflow-hidden`}>

                <div className={`absolute -top-2 ${rtl ? 'left-10' : 'right-10'} w-4 h-4 bg-white border-t border-l border-gray-200 transform rotate-45`}></div>
                <div className="flex flex-col h-full">

                    <div className="flex items-center justify-between px-8 py-6 bg-white sticky top-0 z-10 border-b">
                        <h2 className="text-[20px] font-bold text-gray-900">
                            {text.myCart}
                        </h2>
                        <button
                            onClick={closeCart}
                            className="text-gray-400 hover:text-gray-600 transition"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto px-8 pt-6 bg-white max-h-100">
                        {items.length === 0 ? (
                            <div className="pb-12 flex flex-col items-center justify-center h-full text-center">
                                <svg className="w-24 h-24 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                                <p className="text-gray-500 text-lg mb-2">{text.emptyCart}</p>
                                <Link
                                    href={`/${locale}`}
                                    onClick={closeCart}
                                    className="text-[#842E1B] hover:text-[#6b2516] font-medium"
                                >
                                    {text.startShopping}
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {items.map((item) => (
                                    <React.Fragment key={item.id}>
                                        <CartItem
                                            item={item}
                                            onUpdateQuantity={updateQuantity}
                                            onRemove={removeItem}
                                            variant="compact"
                                            reviewsText={text.reviews}
                                        />
                                        <Divider />
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer with Subtotal and Actions */}
                    {items.length > 0 && (
                        <div className="px-8 pb-6 space-y-6 bg-white border-t">
                            {/* Subtotal */}
                            <div className="flex justify-between items-center">
                                <span className="text-[16px] font-bold text-[#4B1307]">{text.subtotal}</span>
                                <span className="text-[17px] font-semibold text-[#008325]">{subtotal} TND</span>
                            </div>

                            {/* Checkout Button */}
                            <Link
                                href={`/${locale}/checkout`}
                                onClick={closeCart}
                                className="block w-full py-4 bg-[#842E1B] text-white text-center rounded-lg hover:bg-[#5e2d23] transition font-medium text-lg"
                            >
                                {text.checkout}
                            </Link>

                            {/* View Cart Button */}
                            <Link
                                href={`/${locale}/cart`}
                                onClick={closeCart}
                                className="block w-full py-4 border border-[#7a3b2e] text-[#7a3b2e] text-center rounded-lg hover:bg-gray-50 transition font-medium text-lg"
                            >
                                {text.viewCart}
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

