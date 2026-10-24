import supabase from '@/lib/supabase-admin';
import { must, ok, params, period, route } from '@/lib/erp/api';
import { CHANNELS } from '@/lib/erp/constants';
import { teamProgress } from '@/lib/erp/goals';

export const dynamic = 'force-dynamic';

/**
 * The owner's overview (owners only): sales really delivered, margins, cash, debts, stock,
 * delivery and return rates, ad cost per delivered sale, agents against their objectives.
 * ?from=&to= (ISO) and optional filters: channel, agent, product, campaign.
 */
export const GET = route('owner-overview', async (request) => {
    const { from, to } = period(request, 30);
    const q = params(request);
    const channel = q.get('channel');
    const month = new Date(to.getTime() - 1).toISOString().slice(0, 7);
    const [overview, goals, campaigns, costPrices, monthGoal] = await Promise.all([
        supabase.rpc('owner_overview', {
            p_from: from.toISOString(),
            p_to: to.toISOString(),
            p_channel: channel && (CHANNELS as readonly string[]).includes(channel) ? channel : null,
            p_agent: q.get('agent'),
            p_product: q.get('product'),
            p_campaign: q.get('campaign'),
        }),
        // Objectives of the month the period ends in.
        supabase.from('agent_goals').select('*').is('deleted_at', null)
            .eq('month', `${to.toISOString().slice(0, 7)}-01`),
        supabase.from('ad_campaigns').select('id, name, platform').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.rpc('product_cost_prices'),
        // The business's goal for the month the period ends in, and where it stands.
        teamProgress(month),
    ]);
    const prices = (must(costPrices) ?? []) as { product_id: string; product_name: string; cost_price: number | null; base_price: number; margin_percent: number | null }[];
    return ok({
        ...(must(overview) as object),
        goals: must(goals),
        campaign_options: must(campaigns),
        cost_prices: prices,
        month_goal: { month, ...monthGoal },
    });
});
