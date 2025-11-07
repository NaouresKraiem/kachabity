"use client";

import { createContext, useContext, ReactNode } from 'react';

interface LanguageContextType {
    locale: string;
    setLocale: (locale: string) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({
    children,
    locale
}: {
    children: ReactNode;
    locale: string;
}) {
    const setLocale = (newLocale: string) => {
        // Navigate to the new locale
        window.location.href = `/${newLocale}`;
    };

    return (
        <LanguageContext.Provider value={{ locale, setLocale }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}

// Safe version that returns null if outside provider
export function useLanguageSafe() {
    const context = useContext(LanguageContext);
    return context || null;
}
