import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, type Row, ok, params, readBody, route, zDate, zId } from '@/lib/erp/api';
import { AD_PLATFORMS } from '@/lib/erp/constants';

export const dynamic = 'force-dynamic';

/**
 * Advertising campaigns and what they cost. Orders can be tagged with the campaign they came from,
 * which gives the cost per delivered sale. Spend books itself as an advertising expense.
 */

// GET — campaigns with total spend and orders; ?id= adds the spend lines; ?active=1 for pickers.
export const GET = route('marketing-campaigns', async (request) => {
    const q = params(request);
    const id = q.get('id');
    if (id) {
        const [campaign, spend] = await Promise.all([
            supabase.from('ad_campaigns').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
            supabase.from('ad_spend').select('*').eq('campaign_id', id).is('deleted_at', null).order('spend_date', { ascending: false }),
        ]);
        const row = must(campaign);
        if (!row) throw new HttpError('This campaign no longer exists.', 404);
        return ok({ ...row, spend: must(spend) });
    }
    let query = supabase.from('ad_campaigns').select('*').is('deleted_at', null);
    if (q.bool('active')) query = query.eq('active', true);
    const campaigns = must<Row[]>(await query.order('created_at', { ascending: false }));
    if (q.bool('active')) return ok(campaigns);
    const ids = campaigns.map((c) => c.id);
    const [spend, orders] = ids.length
        ? await Promise.all([
            supabase.from('ad_spend').select('campaign_id, amount').in('campaign_id', ids).is('deleted_at', null),
            supabase.from('orders').select('campaign_id, status, total').in('campaign_id', ids).is('deleted_at', null),
        ])
        : [{ data: [], error: null }, { data: [], error: null }];
    const spendRows = (must(spend) ?? []) as { campaign_id: string; amount: number }[];
    const orderRows = (must(orders) ?? []) as { campaign_id: string; status: string; total: number }[];
    return ok(campaigns.map((c) => {
        const mine = orderRows.filter((o) => o.campaign_id === c.id);
        const delivered = mine.filter((o) => o.status === 'delivered');
        const spent = spendRows.filter((s) => s.campaign_id === c.id).reduce((s, r) => s + Number(r.amount), 0);
        return {
            ...c,
            spent,
            orders: mine.length,
            delivered: delivered.length,
            revenue: delivered.reduce((s, o) => s + Number(o.total), 0),
            cost_per_delivered: delivered.length ? spent / delivered.length : null,
        };
    }));
});

const fields = {
    name: z.string().trim().min(1).max(150),
    platform: z.enum(AD_PLATFORMS),
    starts_on: zDate.nullable(),
    ends_on: zDate.nullable(),
    budget: z.number().min(0).max(100_000_000).nullable(),
    notes: z.string().trim().max(2000).nullable(),
    active: z.boolean(),
};

const spendSchema = z.object({
    kind: z.literal('spend'),
    campaign_id: zId.nullable(),
    spend_date: zDate,
    amount: z.number().positive().max(100_000_000),
    account: z.enum(['bank', 'cash', 'payable']).default('bank'),
    note: z.string().trim().max(500).optional(),
});

// POST — a campaign, or { kind: 'spend', ... } an amount spent.
export const POST = route('marketing-campaigns', async (request, actor) => {
    const json = await request.json().catch(() => null);
    if (json?.kind === 'spend') {
        const body = spendSchema.parse(json);
        const { kind: _kind, ...row } = body;
        void _kind;
        return ok(must(await supabase.from('ad_spend').insert({ ...row, note: row.note || null, created_by: actor.userId, created_by_email: actor.email }).select().single()), 201);
    }
    const body = z.object(fields).partial().required({ name: true, platform: true }).parse(json);
    return ok(must(await supabase.from('ad_campaigns').insert({ ...body, created_by: actor.userId, created_by_email: actor.email }).select().single()), 201);
});

export const PUT = route('marketing-campaigns', async (request) => {
    const body = await readBody(request, z.object({ id: zId, ...fields }).partial().required({ id: true }));
    const { id, ...row } = body;
    return ok(must(await supabase.from('ad_campaigns').update(row).eq('id', id).is('deleted_at', null).select().single()));
});

// DELETE ?id= (campaign) | ?spend_id= (a spend line; its expense entry is reversed)
export const DELETE = route('marketing-campaigns', async (request) => {
    const q = params(request);
    const spendId = q.get('spend_id');
    if (spendId) {
        must(await supabase.from('ad_spend').update({ deleted_at: new Date().toISOString() }).eq('id', spendId));
        return ok({ id: spendId });
    }
    const id = q.get('id');
    if (!id) throw new HttpError('Missing id');
    must(await supabase.from('ad_campaigns').update({ deleted_at: new Date().toISOString(), active: false }).eq('id', id));
    return ok({ id });
});
