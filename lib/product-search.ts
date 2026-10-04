import supabase from '@/lib/supabaseClient';

/**
 * Product search, shared by the header suggestions and the products page.
 *
 * Matching and ranking happen in Postgres (public.search_products): names, descriptions,
 * code and category names in all three languages, accent- and Arabic-spelling-insensitive,
 * every word required in any order, with a fallback to similar spellings for typos.
 */

export interface SearchHit {
    id: string;
    rank: number;
}

export const MIN_SEARCH_LENGTH = 2;

/** Ranked ids of live products matching `query`, most relevant first. */
export async function searchProductIds(query: string, limit = 200): Promise<SearchHit[]> {
    const q = query.trim();
    if (q.length < MIN_SEARCH_LENGTH && !/\d/.test(q)) return [];
    const { data, error } = await supabase.rpc('search_products', { p_query: q, p_limit: limit });
    if (error) throw error;
    return ((data ?? []) as { product_id: string; rank: number }[]).map((row) => ({ id: row.product_id, rank: row.rank }));
}
