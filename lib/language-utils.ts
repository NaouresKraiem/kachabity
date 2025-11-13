// Language detection utilities
export const supportedLanguages = ['en', 'fr', 'ar'] as const;
export const defaultLanguage = 'ar';

export type SupportedLanguage = typeof supportedLanguages[number];

// Language names in their native language
export const languageNames: Record<SupportedLanguage, string> = {
    en: 'English',
    fr: 'Français',
    ar: 'العربية'
};

// Language flags
export const languageFlags: Record<SupportedLanguage, string> = {
    en: '🇺🇸',
    fr: '🇫🇷',
    ar: '🇹🇳'
};

// RTL languages
export const rtlLanguages: SupportedLanguage[] = ['ar'];

// Check if a language is RTL
export function isRTL(locale: string): boolean {
    return rtlLanguages.includes(locale as SupportedLanguage);
}

// Get language from Accept-Language header
export function detectLanguageFromHeader(acceptLanguage: string | null): SupportedLanguage {
    if (!acceptLanguage) return defaultLanguage;

    const languages = acceptLanguage
        .split(',')
        .map(lang => lang.split(';')[0].trim().toLowerCase())
        .map(lang => lang.split('-')[0]); // Extract primary language code

    // Find first supported language
    for (const lang of languages) {
        if (supportedLanguages.includes(lang as SupportedLanguage)) {
            return lang as SupportedLanguage;
        }
    }

    return defaultLanguage;
}

// Validate if locale is supported
export function isValidLocale(locale: string): locale is SupportedLanguage {
    return supportedLanguages.includes(locale as SupportedLanguage);
}
