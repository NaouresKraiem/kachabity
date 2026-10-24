// Objectives & commissions, shared by the Next.js routes and the NestJS API (no imports, so both
// can use it as is). Commission types: 'percent' of delivered sales, 'per_order' amount per
// delivered order, 'tiers' prizes for numbers of delivered orders in the month.

export type CommissionType = 'none' | 'percent' | 'per_order' | 'tiers';

/** Reach `orders` delivered orders in the month to earn `prize` (TND). */
export interface PrizeTier {
    orders: number;
    prize: number;
}

export interface CommissionResult {
    commission: number;
    /** 'tiers' only: the highest tier reached, the next one, and how many orders are missing. */
    tier: PrizeTier | null;
    next_tier: PrizeTier | null;
    orders_to_next: number | null;
}

/** Valid tiers, sorted by number of orders; a repeated number keeps its last prize. */
export function normalizeTiers(value: unknown): PrizeTier[] {
    if (!Array.isArray(value)) return [];
    const byOrders = new Map<number, number>();
    for (const t of value) {
        const orders = Number((t as PrizeTier)?.orders);
        const prize = Number((t as PrizeTier)?.prize);
        if (Number.isInteger(orders) && orders > 0 && Number.isFinite(prize) && prize >= 0) byOrders.set(orders, prize);
    }
    return [...byOrders].sort((a, b) => a[0] - b[0]).map(([orders, prize]) => ({ orders, prize }));
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** What a team member earns for a month, from their delivered orders and delivered sales. */
export function commissionFor(
    goal: { commission_type: string; commission_value: number | string; prize_tiers?: unknown } | null,
    delivered: number,
    deliveredRevenue: number
): CommissionResult {
    const none = { commission: 0, tier: null, next_tier: null, orders_to_next: null };
    if (!goal) return none;
    const value = Number(goal.commission_value) || 0;
    if (goal.commission_type === 'percent') return { ...none, commission: round3((deliveredRevenue * value) / 100) };
    if (goal.commission_type === 'per_order') return { ...none, commission: round3(delivered * value) };
    if (goal.commission_type !== 'tiers') return none;
    const tiers = normalizeTiers(goal.prize_tiers);
    const tier = [...tiers].reverse().find((t) => delivered >= t.orders) ?? null;
    const next = tiers.find((t) => delivered < t.orders) ?? null;
    return { commission: tier?.prize ?? 0, tier, next_tier: next, orders_to_next: next ? next.orders - delivered : null };
}

/**
 * The analytics start date (Business settings → "Count analytics from"): periods never begin
 * before it. `start` is YYYY-MM-DD in Tunis time (UTC+1), or null for no reset.
 */
export function clampToStart(from: Date, start: string | null | undefined): Date {
    if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return from;
    const startAt = new Date(`${start}T00:00:00+01:00`);
    return startAt > from ? startAt : from;
}
