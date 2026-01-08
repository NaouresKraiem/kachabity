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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);
    const [mounted, setMounted] = useState(false);

    // Always call the hook - safe version returns null if outside provider
    const languageContext = useLanguageSafe();

    // Use prop locale if provided, otherwise use context, fallback to 'en'
    const locale = propLocale || languageContext?.locale || 'en';
    const t = translations[locale as keyof typeof translations] || translations.en;
    const rtl = isRTL(locale);

    // Auth state removed - authentication disabled

    // Check for user authentication (for mobile header only)
    useEffect(() => {
        async function getUser() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setUser(user);
                }
            } catch (error) {
                // Silent fail
            }
        }
        getUser();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
            setUser(session?.user ?? null);
        });
        return () => subscription.unsubscribe();
    }, []);

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    // Close language menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (isLanguageMenuOpen && !target.closest('.language-menu-container')) {
                setIsLanguageMenuOpen(false);
            }
        };

        if (isLanguageMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isLanguageMenuOpen]);

    // Authentication removed

    // Fetch categories from API
    useEffect(() => {
        async function fetchCategories() {
            try {
                // Try to fetch with translation fields first
                let { data, error } = await supabase
                    .from('categories')
                    .select('id, name, name_ar, name_fr, slug, image_url, sort_order, is_featured')
                    .eq('is_featured', true)
                    .order('sort_order', { ascending: true });

                // If error, try without translation fields (fallback for databases without these columns)
                if (error) {
                    const fallbackResult = await supabase
                        .from('categories')
                        .select('id, name, slug, image_url, sort_order, is_featured')
                        .eq('is_featured', true)
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

    const [search, setSearch] = useState("");

    // Initialize search from URL after mount to prevent hydration mismatch
    useEffect(() => {
        if (mounted) {
            setSearch(searchParams.get("search") || "");
        }
    }, [mounted, searchParams]);

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
        <header className="w-full " dir={mounted ? (rtl ? 'rtl' : 'ltr') : 'ltr'}>
            {/* Top Bar - Desktop */}
            <div className="bg-primary text-white py-4 min-h-[64px] hidden sm:block">
                <div className={`max-w-7xl mx-auto flex justify-between items-center text-sm h-8 px-4`}>
                    <div className={`flex items-center ${mounted && rtl ? 'space-x-reverse space-x-4' : 'space-x-4'}`}>
                        <span dir="ltr">{headerConfig.contact.phone}</span>
                        <span dir="ltr">{headerConfig.contact.email}</span>
                    </div>

                    <div className={`flex items-center ${mounted && rtl ? 'space-x-reverse space-x-2' : 'space-x-2'}`}>
                        <span>{t.followUs}</span>
                        <div className={`flex ${mounted && rtl ? 'space-x-reverse space-x-2' : 'space-x-2'} justify-center`}>
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

                    <div className={`flex items-center ${mounted && rtl ? 'space-x-reverse space-x-4' : 'space-x-4'} min-h-[32px]`}>
                        {/* Authentication removed - sign in/register link removed */}
                        <div className="relative group">
                            <button className={`flex items-center ${mounted && rtl ? 'flex-row-reverse space-x-reverse space-x-1' : 'space-x-1'} hover:text-gray-300`}>
                                <span>{headerConfig.languages.find(lang => lang.code === locale)?.flag || '🇺🇸'}</span>
                                <span>{headerConfig.languages.find(lang => lang.code === locale)?.name || 'English'}</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <div className={`absolute ${mounted && rtl ? 'left-0' : 'right-0'} mt-2 w-48 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50`}>
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
                                                className={`flex items-center ${mounted && rtl ? 'flex-row-reverse space-x-reverse' : 'space-x-2'} px-4 py-2 text-sm text-gray-700 hover:bg-gray-100`}
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

            {/* Top Bar - Mobile */}
            <div className="bg-primary text-white py-2 px-2 sm:hidden">
                <div className={`max-w-7xl mx-auto flex justify-between items-center gap-2`}>
                    {/* Left: Social Media Icons */}
                    <div className={`flex items-center ${mounted && rtl ? 'space-x-reverse space-x-3' : 'space-x-3'}`}>
                        {Object.entries(headerConfig.social).map(([platform, data]) => (
                            <a
                                key={platform}
                                href={data.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-gray-300 transition-colors"
                                aria-label={`Follow us on ${platform}`}
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d={data.icon} />
                                </svg>
                            </a>
                        ))}
                    </div>

                    {/* Right: Dark Mode + Language Selector */}
                    <div className={`flex items-center ${mounted && rtl ? 'space-x-reverse space-x-3' : 'space-x-3'}`}>
                        {/* Dark Mode Toggle */}
                        <button
                            className="hover:text-gray-300 transition-colors"
                            aria-label="Toggle dark mode"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        </button>

                        {/* Language Selector */}
                        <div className="relative language-menu-container">
                            <button
                                onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
                                className={`flex items-center ${mounted && rtl ? 'flex-row-reverse space-x-reverse space-x-1' : 'space-x-1'} hover:text-gray-300 transition-colors`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {isLanguageMenuOpen && (
                                <div className={`absolute ${mounted && rtl ? 'left-0' : 'right-0'} mt-2 w-48 bg-white rounded-md shadow-lg z-50 opacity-100 visible transition-all duration-200`}>
                                    <div className="py-1">
                                        {headerConfig.languages.map((lang) => {
                                            const currentPath = pathname || '';
                                            const pathWithoutLocale = currentPath.replace(/^\/(en|fr|ar)/, '') || '/';
                                            let newPath = pathWithoutLocale === '/' ? `/${lang.code}` : `/${lang.code}${pathWithoutLocale}`;
                                            const queryString = searchParams.toString();
                                            if (queryString) {
                                                newPath += `?${queryString}`;
                                            }
                                            return (
                                                <Link
                                                    key={lang.code}
                                                    href={newPath}
                                                    className={`flex items-center ${mounted && rtl ? 'flex-row-reverse space-x-reverse' : 'space-x-2'} px-4 py-2 text-sm text-gray-700 hover:bg-gray-100`}
                                                    onClick={() => setIsLanguageMenuOpen(false)}
                                                >
                                                    <span>{lang.flag}</span>
                                                    <span>{lang.name}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* Main Header - Desktop */}
            <div className="bg-white border-b border-gray-200 py-4 px-4 hidden sm:block">
                <div className="max-w-7xl mx-auto flex justify-between items-center min-h-[72px]">
                    <div className="cursor-pointer flex items-center space-x-2 shrink-0" onClick={() => router.push(`/${locale}`)}>
                        <Image
                            src="/assets/images/logoKachabity.jpg"
                            alt="logo"
                            width={60}
                            height={60}
                            priority
                            className="object-contain"
                        />
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
                    <div className="flex items-center space-x-4 shrink-0">
                        <CartButton />
                    </div>
                </div>
            </div>
            {/* Mobile Header - New Design */}
            <div className="bg-black text-white py-2 px-2 sm:hidden">
                <div className={`max-w-7xl mx-auto flex justify-between items-center gap-2`}>
                    {/* Left: Hamburger Menu + User Profile */}
                    <div className={`flex items-center ${mounted && rtl ? 'space-x-reverse space-x-3' : 'space-x-3'}`}>
                        {/* Hamburger Menu Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="p-1 hover:text-gray-300 transition-colors"
                            aria-label="Toggle menu"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {isMobileMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>

                        {/* User Profile */}
                        {user ? (
                            <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden">
                                    {user.user_metadata?.avatar_url ? (
                                        <Image
                                            src={user.user_metadata.avatar_url}
                                            alt={user.user_metadata?.full_name || user.email || 'User'}
                                            width={32}
                                            height={32}
                                            className="object-cover w-full h-full"
                                        />
                                    ) : (
                                        <span className="text-white text-xs font-medium">
                                            {(user.user_metadata?.full_name || user.email || 'U').charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <span className="text-white text-sm font-medium">
                                    {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <span className="text-white text-sm font-medium">
                                    Guest
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Right: Action Icons (User Dropdown, Phone, Mail, Search) */}
                    <div className={`flex items-center ${mounted && rtl ? 'space-x-reverse space-x-2' : 'space-x-2'}`}>
                        {/* User Dropdown */}
                        {user && (
                            <div className="relative">
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="p-1 hover:text-gray-300 transition-colors"
                                    aria-label="User menu"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {isUserMenuOpen && (
                                    <div className={`absolute ${mounted && rtl ? 'left-0' : 'right-0'} mt-2 w-48 bg-white rounded-md shadow-lg z-50`}>
                                        <div className="py-1">
                                            <Link
                                                href={`/${locale}/settings`}
                                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                onClick={() => setIsUserMenuOpen(false)}
                                            >
                                                Settings
                                            </Link>
                                            <button
                                                onClick={async () => {
                                                    await supabase.auth.signOut();
                                                    router.push(`/${locale}`);
                                                    setIsUserMenuOpen(false);
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                Logout
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Phone Icon */}
                        <a
                            href={`tel:${headerConfig.contact.phone.replace(/\s/g, '')}`}
                            className="p-1 hover:text-gray-300 transition-colors"
                            aria-label="Phone"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                        </a>

                        {/* Mail Icon */}
                        <a
                            href={`mailto:${headerConfig.contact.email}`}
                            className="p-1 hover:text-gray-300 transition-colors"
                            aria-label="Email"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </a>

                        {/* Search Icon */}
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-1 hover:text-gray-300 transition-colors"
                            aria-label="Search"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Mobile Menu Content */}
                {isMobileMenuOpen && (
                    <div className="mt-3 pb-2 space-y-3">
                        {/* Mobile Search Bar */}
                        <div className="relative bg-gray-800 rounded-lg">
                            <form onSubmit={handleSearch}>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={t.searchPlaceholder + ' ...'}
                                    className="w-full py-2 px-4 pr-10 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent placeholder-gray-400"
                                />
                                <button className={`absolute ${rtl ? 'left-2' : 'right-2'} top-1/2 transform -translate-y-1/2`} type="submit">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </button>
                            </form>
                        </div>

                        {/* Mobile Navigation Menu */}
                        <nav className="flex flex-col space-y-1">
                            {headerConfig.navigation.map((item) => (
                                item.label === "Categories" ? (
                                    <div key={item.href} className="relative">
                                        <button
                                            onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
                                            className="text-white hover:text-gray-300 transition flex items-center justify-between w-full py-2 px-2"
                                        >
                                            <span>{t.categories}</span>
                                            <svg
                                                className={`w-4 h-4 transition-transform ${isCategoriesOpen ? 'rotate-180' : ''}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        {isCategoriesOpen && (
                                            <div className="pl-4 space-y-1">
                                                <Link
                                                    href={`/${locale}/categories`}
                                                    className="block py-2 text-gray-300 hover:text-white transition"
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                >
                                                    {t.allCategories}
                                                </Link>
                                                {categories.map((category) => (
                                                    <Link
                                                        key={category.id}
                                                        href={`/${locale}/products?category=${category.slug}`}
                                                        className="block py-2 text-gray-300 hover:text-white transition"
                                                        onClick={() => setIsMobileMenuOpen(false)}
                                                    >
                                                        {getCategoryName(category, locale)}
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : item.label === "Discounts" ?
                                    <Link
                                        key={`/${locale}/products?promo=true`}
                                        href={`/${locale}/products?promo=true`}
                                        className="text-white hover:text-gray-300 transition py-2 px-2 block"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        {t.discounts}
                                    </Link>
                                    : item.label === "About Us" ?
                                        <Link
                                            key={item.href}
                                            href={`/${locale}${item.href}`}
                                            className="text-white hover:text-gray-300 transition py-2 px-2 block"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            {t.aboutUs}
                                        </Link>
                                        : item.label === "Contact Us" ?
                                            <Link
                                                key={item.href}
                                                href={`/${locale}${item.href}`}
                                                className="text-white hover:text-gray-300 transition py-2 px-2 block"
                                                onClick={() => setIsMobileMenuOpen(false)}
                                            >
                                                {t.contactUs}
                                            </Link>
                                            :
                                            (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className="text-white hover:text-gray-300 transition py-2 px-2 block"
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                >
                                                    {item.label}
                                                </Link>
                                            )
                            ))}
                            <div
                                className={`cursor-pointer flex items-center ${mounted && rtl ? 'flex-row-reverse space-x-reverse space-x-2' : 'space-x-2'} border border-[#FFFFFF] px-4 py-2 rounded-[11px] mt-2`}
                                onClick={() => {
                                    router.push(`/${locale}/products`);
                                    setIsMobileMenuOpen(false);
                                }}
                            >
                                <Image src="/assets/images/icons/Cup.svg" alt="handmade" width={16} height={16} />
                                <span className="font-medium text-sm">{t.handmade}</span>
                            </div>
                        </nav>
                    </div>
                )}
            </div>

            {/* Navigation Bar - Desktop */}
            <div className="bg-black text-white py-3 px-4 min-h-[52px] hidden sm:block">
                <div className={`max-w-7xl mx-auto flex justify-between items-center ${mounted && rtl ? 'flex-row-reverse' : ''}`}>
                    <nav className={`flex ${mounted && rtl ? 'space-x-reverse space-x-8' : 'space-x-8'}`}>
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
                                                        href={`/${locale}/categories`}
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
                    <div className={`gap-5 cursor-pointer flex items-center ${mounted && rtl ? 'flex-row-reverse space-x-reverse space-x-2' : 'space-x-2'} border border-[#FFFFFF] px-4 py-2 rounded-[11px]`} onClick={() => router.push(`/${locale}/products`)} >
                        <Image src="/assets/images/icons/Cup.svg" alt="handmade" width={16} height={16} />
                        <span className="font-medium">{t.handmade}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
