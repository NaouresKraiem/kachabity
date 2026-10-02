/**
 * Home page layout and product lists, edited in Admin → Landing page and stored as JSON in
 * the site_settings row `landing_config`. Shared by the storefront, the API and the admin.
 * Product picks themselves live in the landing_products table.
 */

/** Every section of the home page, in its default order. */
export const HOME_SECTIONS = [
    'showcase',
    'new_arrivals',
    'services',
    'categories',
    'top_products',
    'spotlight',
    'promo_products',
    'sale_banners',
    'reels',
    'reviews',
    'how_to_order',
    'faq',
] as const;
export type HomeSectionKey = (typeof HOME_SECTIONS)[number];

/** Sections whose products the admin picks (landing_products.section). */
export type LandingSection = 'new_arrivals' | 'showcase' | 'ring' | 'top_products' | 'promo_products' | 'spotlight';
export const LANDING_SECTIONS: LandingSection[] = ['new_arrivals', 'showcase', 'ring', 'top_products', 'promo_products', 'spotlight'];

/** Product lists that show pinned products first, then fill up automatically. */
export type ListSection = 'new_arrivals' | 'top_products' | 'promo_products' | 'spotlight';
export const LIST_SECTIONS: ListSection[] = ['new_arrivals', 'top_products', 'promo_products', 'spotlight'];

export interface ListSettings {
    count: number;
    /** After the pinned products, fill with the automatic choice (newest, best sellers, ...). */
    autofill: boolean;
}

export interface LandingConfig {
    layout: { key: HomeSectionKey; visible: boolean }[];
    lists: Record<ListSection, ListSettings>;
    /** Category of the collection spotlight; null picks the one with the most products. */
    spotlightCategoryId: string | null;
}

export const MAX_LIST_COUNT = 30;

export const DEFAULT_LANDING_CONFIG: LandingConfig = {
    layout: HOME_SECTIONS.map((key) => ({ key, visible: true })),
    lists: {
        new_arrivals: { count: 10, autofill: true },
        top_products: { count: 10, autofill: true },
        promo_products: { count: 6, autofill: true },
        spotlight: { count: 10, autofill: true },
    },
    spotlightCategoryId: null,
};

/** Fills gaps with defaults and drops unknown values, so a partial or old config is always usable. */
export function normalizeLandingConfig(input: unknown): LandingConfig {
    const raw = (input && typeof input === 'object' ? input : {}) as Partial<Record<keyof LandingConfig, unknown>>;

    const seen = new Set<HomeSectionKey>();
    const layout: LandingConfig['layout'] = [];
    if (Array.isArray(raw.layout)) {
        for (const entry of raw.layout as { key?: unknown; visible?: unknown }[]) {
            const key = entry?.key as HomeSectionKey;
            if (!HOME_SECTIONS.includes(key) || seen.has(key)) continue;
            seen.add(key);
            layout.push({ key, visible: entry.visible !== false });
        }
    }
    for (const key of HOME_SECTIONS) if (!seen.has(key)) layout.push({ key, visible: true });

    const rawLists = (raw.lists && typeof raw.lists === 'object' ? raw.lists : {}) as Record<string, Partial<ListSettings> | undefined>;
    const lists = Object.fromEntries(LIST_SECTIONS.map((section) => {
        const fallback = DEFAULT_LANDING_CONFIG.lists[section];
        const count = Number(rawLists[section]?.count);
        return [section, {
            count: Number.isInteger(count) && count >= 1 && count <= MAX_LIST_COUNT ? count : fallback.count,
            autofill: typeof rawLists[section]?.autofill === 'boolean' ? rawLists[section]!.autofill! : fallback.autofill,
        }];
    })) as Record<ListSection, ListSettings>;

    const spotlightCategoryId = typeof raw.spotlightCategoryId === 'string' && raw.spotlightCategoryId ? raw.spotlightCategoryId : null;

    return { layout, lists, spotlightCategoryId };
}

export function parseLandingConfig(value: string | null | undefined): LandingConfig {
    try {
        return normalizeLandingConfig(value ? JSON.parse(value) : null);
    } catch {
        return DEFAULT_LANDING_CONFIG;
    }
}
