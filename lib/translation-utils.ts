/**
 * Translation utility functions
 * Simple text translation for multilingual support
 */

interface TranslationCache {
    [key: string]: {
        ar?: string;
        fr?: string;
    };
}

// Simple in-memory cache
const translationCache: TranslationCache = {};

/**
 * Get translated text for a given locale
 * Falls back to original text if translation not available
 */
export function getTranslatedText(
    originalText: string | undefined | null,
    locale: string
): string {
    if (!originalText) return '';
    if (locale === 'en') return originalText;

    // Check cache first
    const cached = translationCache[originalText];
    if (cached && cached[locale as 'ar' | 'fr']) {
        return cached[locale as 'ar' | 'fr']!;
    }

    // TODO: Implement auto-translation here
    // For now, return original text
    // You can integrate with translation APIs like:
    // - Google Translate API
    // - DeepL API
    // - OpenAI API

    return originalText;
}

/**
 * Translate product data to target locale
 */
interface Product {
    id: string;
    title: string;
    description?: string;
    [key: string]: unknown; // allow other optional fields
  }
  
  export function translateProduct(product: Product, locale: string): Product {
    if (locale === 'en') return product;
  
    return {
      ...product,
      title: getTranslatedText(product.title, locale),
      description: getTranslatedText(product.description, locale),
    };
  }

/**
 * Manual translations for common UI terms
 * Add your own translations here
 */
const commonTranslations: Record<string, Record<string, string>> = {
    'Add to Cart': {
        ar: 'أضف إلى السلة',
        fr: 'Ajouter au panier'
    },
    'In Stock': {
        ar: 'متوفر',
        fr: 'En stock'
    },
    'Out of Stock': {
        ar: 'غير متوفر',
        fr: 'Rupture de stock'
    },
    // Add more common phrases here
};

export function t(text: string, locale: string): string {
    if (locale === 'en') return text;
    return commonTranslations[text]?.[locale] || text;
}



