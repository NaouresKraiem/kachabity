"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { headerConfig } from '@/lib/config';
import { useLanguageSafe } from '@/lib/language-context';
import { isRTL } from '@/lib/language-utils';
import CartButton from '../cart/CartButton';
import supabase from '@/lib/supabaseClient';
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const translations = {
    en: {
        followUs: "Follow Us:",
        signInRegister: "Sign In / Register",
        settings: "Settings",
        logout: "Logout",
        loading: "Loading...",
        allCategories: "All Categories",
        noCategoriesFound: "No categories found",
        searchPlaceholder: "Search for a product ",
        handmade: "100% handmade",
        categories: "Categories",
        discounts: "Discounts",
        aboutUs: "About Us",
        contactUs: "Contact Us"
    },
    fr: {
        followUs: "Suivez-nous :",
        signInRegister: "Se connecter / S'inscrire",
        settings: "Paramètres",
        logout: "Déconnexion",
        loading: "Chargement...",
        allCategories: "Toutes les catégories",
        noCategoriesFound: "Aucune catégorie trouvée",
        searchPlaceholder: "Rechercher un produit",
        handmade: "100% fait main",
        categories: "Catégories",
        discounts: "Remises",
        aboutUs: "À propos",
        contactUs: "Contactez-nous"
    },
    ar: {
        followUs: "تابعنا:",
        signInRegister: "تسجيل الدخول / التسجيل",
        settings: "الإعدادات",
        logout: "تسجيل الخروج",
        loading: "جاري التحميل...",
        allCategories: "جميع الفئات",
        noCategoriesFound: "لم يتم العثور على فئات",
        searchPlaceholder: "ابحث عن منتج  ",
        handmade: "100% مصنوع يدوياً",
        categories: "الفئات",
        discounts: "التخفيضات",
        aboutUs: "من نحن",
        contactUs: "اتصل بنا"
    }
};

interface Category {
    id: string;
    name: string;
    name_ar?: string;
    name_fr?: string;
    slug: string;
    image_url?: string;
    sort_order: number;
    is_featured?: boolean;
}

// Helper function to get translated category name
function getCategoryName(category: Category, locale: string): string {
    if (locale === 'ar' && category.name_ar) {
        return category.name_ar;
    }
    if (locale === 'fr' && category.name_fr) {
        return category.name_fr;
    }
    return category.name;
}

interface StaticHeaderProps {
    locale?: string;
}

export default function StaticHeader({ locale: propLocale }: StaticHeaderProps = {}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);

    // Always call the hook - safe version returns null if outside provider
    const languageContext = useLanguageSafe();

    // Use prop locale if provided, otherwise use context, fallback to 'en'
    const locale = propLocale || languageContext?.locale || 'en';
    const t = translations[locale as keyof typeof translations] || translations.en;
    const rtl = isRTL(locale);

    // Auth state
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            const { data } = await supabase.auth.getUser();
            if (!mounted) return;
            if (data.user) {
                setUserEmail(data.user.email || null);
                // @ts-ignore
                const meta = data.user.user_metadata || {};
                setUserName(meta.first_name || meta.full_name || null);
            }
        })();
        const { data: sub } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
            const u = session?.user;
            setUserEmail(u?.email || null);
            // @ts-ignore
            const meta = u?.user_metadata || {};
            setUserName(meta.first_name || meta.full_name || null);
        });
        return () => { mounted = false; sub.subscription.unsubscribe(); };
    }, []);

    // Fetch categories from API
    useEffect(() => {
        async function fetchCategories() {
            try {
                // Try to fetch with translation fields first
                let { data, error } = await supabase
                    .from('categories')
                    .select('id, name, name_ar, name_fr, slug, image_url, sort_order, is_featured')
                    .order('sort_order', { ascending: true });

                // If error, try without translation fields (fallback for databases without these columns)
                if (error) {
                    const fallbackResult = await supabase
                        .from('categories')
                        .select('id, name, slug, image_url, sort_order, is_featured')
                        .order('sort_order', { ascending: true });

                    if (fallbackResult.error) {
                        throw fallbackResult.error;
                    }
                    data = fallbackResult.data;
                    error = null;
                }

                if (error) throw error;

                if (data) {
                    setCategories(data);
                }
            } catch (error) {
                console.error('Error fetching categories:', error);
                // Set empty array on error to prevent UI issues
                setCategories([]);
            } finally {
                setIsLoadingCategories(false);
            }
        }

        fetchCategories();
    }, []);

    const [search, setSearch] = useState(searchParams.get("search") || "");

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams);
        if (search.trim()) {
            params.set("search", search.trim());
        } else {
            params.delete("search");
        }
        router.push(`products?${params.toString()}`);
    };

    return (
        <header className="w-full sticky top-0 z-1000" dir={rtl ? 'rtl' : 'ltr'}>
            {/* Top Bar */}
            <div className="bg-primary text-white py-4 px-8">
                <div className={`max-w-7xl mx-auto flex justify-between items-center text-sm `}>
                    <div className={`flex items-center ${rtl ? 'space-x-reverse space-x-4' : 'space-x-4'}`}>
                        <span dir="ltr">{headerConfig.contact.phone}</span>
                        <span dir="ltr">{headerConfig.contact.email}</span>
                    </div>

                    <div className={`flex items-center ${rtl ? 'space-x-reverse space-x-2' : 'space-x-2'}`}>
                        <span>{t.followUs}</span>
                        <div className={`flex ${rtl ? 'space-x-reverse space-x-2' : 'space-x-2'} justify-center`}>
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

                    <div className={`flex items-center ${rtl ? 'space-x-reverse space-x-4' : 'space-x-4'}`}>
                        {userEmail ? (
                            <div className="relative group">
                                <button className={`flex items-center gap-2 hover:text-gray-300 ${rtl ? 'flex-row-reverse' : ''}`}>
                                    <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center">
                                        {(userName || userEmail).charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm">{userName || userEmail}</span>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                <div className={`absolute ${rtl ? 'left-0' : 'right-0'} mt-2 w-48 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50`}>
                                    <div className="py-1">
                                        <Link href={`/${locale}/settings`} className={`block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${rtl ? 'text-right' : 'text-left'}`}>{t.settings}</Link>
                                        <button
                                            onClick={async () => { await supabase.auth.signOut(); router.refresh(); }}
                                            className={`w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${rtl ? 'text-right' : 'text-left'}`}
                                        >
                                            {t.logout}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <Link href={`/${locale}/auth`} className="hover:text-gray-300">{t.signInRegister}</Link>
                        )}
                        <div className="relative group">
                            <button className={`flex items-center ${rtl ? 'flex-row-reverse space-x-reverse space-x-1' : 'space-x-1'} hover:text-gray-300`}>
                                <span>{headerConfig.languages.find(lang => lang.code === locale)?.flag || '🇺🇸'}</span>
                                <span>{headerConfig.languages.find(lang => lang.code === locale)?.name || 'English'}</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <div className={`absolute ${rtl ? 'left-0' : 'right-0'} mt-2 w-48 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50`}>
                                <div className="py-1">
                                    {headerConfig.languages.map((lang) => {
                                        // Preserve current path when switching languages
                                        const currentPath = pathname || '';
                                        // Remove current locale from path if it exists
                                        const pathWithoutLocale = currentPath.replace(/^\/(en|fr|ar)/, '') || '/';
                                        // Build new path with selected language
                                        let newPath = pathWithoutLocale === '/' ? `/${lang.code}` : `/${lang.code}${pathWithoutLocale}`;

                                        // Preserve search params if they exist
                                        const queryString = searchParams.toString();
                                        if (queryString) {
                                            newPath += `?${queryString}`;
                                        }

                                        return (
                                            <Link
                                                key={lang.code}
                                                href={newPath}
                                                className={`flex items-center ${rtl ? 'flex-row-reverse space-x-reverse' : 'space-x-2'} px-4 py-2 text-sm text-gray-700 hover:bg-gray-100`}
                                            >
                                                <span>{lang.flag}</span>
                                                <span>{lang.name}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Main Header */}
            <div className="bg-white border-b border-gray-200 py-4 px-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="cursor-pointer flex items-center space-x-2" onClick={() => router.push(`/${locale}`)}>
                        <Image src="/assets/images/logoKachabity.jpg" alt="logo" width={60} height={60} />
                    </div>

                    {/* Search - Keep original design */}
                    <div className="flex-1 max-w-lg mx-8">
                        <div className="relative bg-[#FAF7F2] rounded-[15px] text-black">
                            <form onSubmit={handleSearch}>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={t.searchPlaceholder + ' ...'}
                                    className={`color-black w-full py-2 rounded-[15px] font-light border placeholder-[#969696] border-gray-300 br focus:outline-none focus:ring-2 focus:ring-[#7a3b2e] focus:border-transparent ${rtl ? 'pl-10 pr-4' : 'pl-4 pr-10'}`}
                                />
                                <button className={`absolute ${rtl ? 'left-2' : 'right-2'} top-1/2 transform -translate-y-1/2`} type="submit">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Cart */}
                    <div className="flex items-center space-x-4">
                        <CartButton />
                    </div>
                </div>
            </div>
            {/* Navigation Bar */}
            <div className="bg-black text-white py-3 px-4">
                <div className={`max-w-7xl mx-auto flex justify-between items-center ${rtl ? 'flex-row-reverse' : ''}`}>
                    <nav className={`flex ${rtl ? 'space-x-reverse space-x-8' : 'space-x-8'}`}>
                        {headerConfig.navigation.map((item) => (
                            item.label === "Categories" ? (
                                <div
                                    key={item.href}
                                    className="relative"
                                    onMouseEnter={() => setIsCategoriesOpen(true)}
                                    onMouseLeave={() => setIsCategoriesOpen(false)}
                                >
                                    <button
                                        className="text-white hover:text-gray-300 transition flex items-center space-x-1"
                                    >

                                        <>

                                            <span>{t.categories}</span>
                                            <svg
                                                className={`w-4 h-4 transition-transform ${isCategoriesOpen ? 'rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </>


                                    </button>

                                    {/* Dropdown Menu */}
                                    <div
                                        className={`absolute top-full ${rtl ? 'right-0' : 'left-0'} mt-2 w-56 bg-white rounded-md shadow-lg transition-all duration-200 z-50 ${isCategoriesOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
                                            }`}
                                    >
                                        <div className="py-2">
                                            {isLoadingCategories ? (
                                                <div className={`px-4 py-2 text-sm text-gray-500 ${rtl ? 'text-right' : 'text-left'}`}>{t.loading}</div>
                                            ) : categories.length > 0 ? (
                                                <>
                                                    <Link
                                                        key={'all-categories'}
                                                        href={`/${locale}/products`}
                                                        className={`block px-4 py-1 text-lg font-medium text-gray-700 hover:bg-gray-100 hover:text-[#7a3b2e] transition ${rtl ? 'text-right' : 'text-left'}`}
                                                    >
                                                        {t.allCategories}
                                                    </Link>
                                                    {
                                                        categories.map((category) => (
                                                            <Link
                                                                key={category.id}
                                                                href={`/${locale}/products?category=${category.slug}`}
                                                                className={`block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-[#7a3b2e] transition ${rtl ? 'text-right' : 'text-left'}`}
                                                            >
                                                                {getCategoryName(category, locale)}
                                                            </Link>
                                                        ))
                                                    }

                                                </>

                                            ) : (
                                                <div className={`px-4 py-2 text-sm text-gray-500 ${rtl ? 'text-right' : 'text-left'}`}>{t.noCategoriesFound}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : item.label === "Discounts" ?
                                <Link
                                    key={`/${locale}/products?promo=true`}
                                    href={`/${locale}/products?promo=true`}
                                    className="text-white hover:text-gray-300 transition"
                                >
                                    {t.discounts}
                                </Link>
                                : item.label === "About Us" ?
                                    <Link
                                        key={item.href}
                                        href={`/${locale}${item.href}`}
                                        className="text-white hover:text-gray-300 transition"
                                    >
                                        {t.aboutUs}
                                    </Link>
                                    : item.label === "Contact Us" ?
                                        <Link
                                            key={item.href}
                                            href={`/${locale}${item.href}`}
                                            className="text-white hover:text-gray-300 transition"
                                        >
                                            {t.contactUs}
                                        </Link>
                                        :
                                        (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className="text-white hover:text-gray-300 transition"
                                            >
                                                {item.label}
                                            </Link>
                                        )
                        ))}
                    </nav>
                    <div className={`gap-5 cursor-pointer flex items-center ${rtl ? 'flex-row-reverse space-x-reverse space-x-2' : 'space-x-2'} border border-[#FFFFFF] px-4 py-2 rounded-[11px]`} onClick={() => router.push(`/${locale}/products`)} >
                        <Image src="/assets/images/icons/Cup.svg" alt="handmade" width={16} height={16} />
                        <span className="font-medium">{t.handmade}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
