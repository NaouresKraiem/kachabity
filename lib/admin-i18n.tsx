"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import "dayjs/locale/ar";
import { adminTranslations } from "@/lib/admin-translations";

/**
 * Admin dashboard language (separate from the storefront locale in the URL). Strings are
 * written in English in the code and looked up with t("English text", { vars }); French and
 * Arabic live in lib/admin-translations.ts. Missing entries fall back to English.
 * The choice is remembered per browser.
 */
export type AdminLocale = "en" | "fr" | "ar";
export const ADMIN_LOCALES: { value: AdminLocale; label: string }[] = [
    { value: "en", label: "EN" },
    { value: "fr", label: "FR" },
    { value: "ar", label: "ع" },
];

/** Intl locale for dates and numbers in each admin language. */
export const DATE_LOCALES: Record<AdminLocale, string> = { en: "en-GB", fr: "fr-FR", ar: "ar-TN" };

const STORAGE_KEY = "admin_locale";

/** Marks English text defined outside components (constants) for translation; render it with t(). */
export const msg = (text: string) => text;

type Vars = Record<string, string | number>;

function interpolate(text: string, vars?: Vars) {
    return vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text;
}

interface AdminI18n {
    locale: AdminLocale;
    dir: "ltr" | "rtl";
    setLocale: (locale: AdminLocale) => void;
    t: (text: string, vars?: Vars) => string;
}

const AdminI18nContext = createContext<AdminI18n>({
    locale: "en",
    dir: "ltr",
    setLocale: () => undefined,
    t: interpolate,
});

export function AdminI18nProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<AdminLocale>("en");

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === "en" || saved === "fr" || saved === "ar") setLocaleState(saved);
            else if (navigator.language.startsWith("fr")) setLocaleState("fr");
            else if (navigator.language.startsWith("ar")) setLocaleState("ar");
        } catch {
            // storage unavailable: keep English
        }
    }, []);

    useEffect(() => {
        dayjs.locale(locale);
    }, [locale]);

    const setLocale = useCallback((next: AdminLocale) => {
        setLocaleState(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // storage unavailable: the choice lasts for this visit
        }
    }, []);

    const value = useMemo<AdminI18n>(() => {
        const dictionary = locale === "en" ? null : adminTranslations[locale];
        return {
            locale,
            dir: locale === "ar" ? "rtl" : "ltr",
            setLocale,
            t: (text, vars) => interpolate(dictionary?.[text] ?? text, vars),
        };
    }, [locale, setLocale]);

    return <AdminI18nContext.Provider value={value}>{children}</AdminI18nContext.Provider>;
}

export function useAdminT() {
    return useContext(AdminI18nContext);
}
