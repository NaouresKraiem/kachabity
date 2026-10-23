import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, ok, params, readBody, route, zDate } from '@/lib/erp/api';
import { TREASURY_CATEGORIES } from '@/lib/erp/constants';

export const dynamic = 'force-dynamic';

/**
 * Cash and bank: balances (till, bank, cash the delivery company still holds), and the money
 * movements that aren't order payments or bills (opening balances, owner money in/out, loans,
 * transfers between the till and the bank, other income and expenses).
 */

// GET — balances and a combined statement of every money movement (?account=cash|bank&from=&to=).
export const GET = route('finance-treasury', async (request) => {
    const q = params(request);
    const account = q.get('account');
    const from = q.get('from');
    const to = q.get('to');
    const inRange = <T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(query: T, column: string) => {
        let out = query;
        if (from) out = out.gte(column, from);
        if (to) out = out.lte(column, `${to}T23:59:59.999Z`);
        return out;
    };
    const accounts = account ? [account] : ['cash', 'bank'];

    const [balances, payments, remittances, movements, billPayments, adSpend] = await Promise.all([
        supabase.rpc('treasury_balances'),
        inRange(supabase.from('order_payments').select('id, amount, method, account, received_at, reference, order:orders(order_number, customer_first_name, customer_last_name)')
            .in('account', accounts).is('deleted_at', null), 'received_at').order('received_at', { ascending: false }).limit(500),
        inRange(supabase.from('cod_remittances').select('id, net_amount, fees, account, received_on, reference, provider').in('account', accounts).is('deleted_at', null), 'received_on').limit(500),
        inRange(supabase.from('treasury_movements').select('*').in('account', accounts).is('deleted_at', null), 'occurred_on').limit(500),
        inRange(supabase.from('bill_payments').select('id, amount, account, paid_on, reference, bill:bills(number, supplier_reference, payee, supplier:suppliers(name))').in('account', accounts).is('deleted_at', null), 'paid_on').limit(500),
        inRange(supabase.from('ad_spend').select('id, amount, account, spend_date, campaign:ad_campaigns(name)').in('account', accounts).is('deleted_at', null), 'spend_date').limit(500),
    ]);

    type Line = { id: string; kind: string; date: string; account: string; amount: number; label: string; reference?: string | null; deletable?: boolean; category?: string };
    const name = (o: { customer_first_name?: string; customer_last_name?: string } | null) => [o?.customer_first_name, o?.customer_last_name].filter(Boolean).join(' ');
    const lines: Line[] = [
        ...(must(payments) as unknown as { id: string; amount: number; account: string; received_at: string; reference: string | null; method: string; order: { order_number: string; customer_first_name: string; customer_last_name: string } | null }[])
            .map((p) => ({ id: p.id, kind: 'payment', date: p.received_at, account: p.account, amount: Number(p.amount), label: `${p.order?.order_number ?? ''} ${name(p.order)}`.trim(), reference: p.reference })),
        ...(must(remittances) as { id: string; net_amount: number; account: string; received_on: string; reference: string | null; provider: string }[])
            .map((r) => ({ id: r.id, kind: 'remittance', date: r.received_on, account: r.account, amount: Number(r.net_amount), label: `Payout ${r.provider}`, reference: r.reference })),
        ...(must(movements) as { id: string; direction: string; amount: number; account: string; occurred_on: string; label: string; reference: string | null; category: string }[])
            .map((m) => ({ id: m.id, kind: 'movement', date: m.occurred_on, account: m.account, amount: m.direction === 'in' ? Number(m.amount) : -Number(m.amount), label: m.label, reference: m.reference, category: m.category, deletable: m.category !== 'pos_difference' })),
        ...(must(billPayments) as unknown as { id: string; amount: number; account: string; paid_on: string; reference: string | null; bill: { number: string; supplier_reference: string | null; payee: string | null; supplier: { name: string } | null } | null }[])
            .map((b) => ({ id: b.id, kind: 'bill_payment', date: b.paid_on, account: b.account, amount: -Number(b.amount), label: `${b.bill?.supplier?.name ?? b.bill?.payee ?? ''} ${b.bill?.supplier_reference ?? b.bill?.number ?? ''}`.trim(), reference: b.reference })),
        ...(must(adSpend) as unknown as { id: string; amount: number; account: string; spend_date: string; campaign: { name: string } | null }[])
            .map((a) => ({ id: a.id, kind: 'ad_spend', date: a.spend_date, account: a.account, amount: -Number(a.amount), label: `Ads ${a.campaign?.name ?? ''}`.trim() })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    return ok({ balances: must(balances), lines: lines.slice(0, 1000) });
});

const createSchema = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('movement'),
        account: z.enum(['cash', 'bank']),
        direction: z.enum(['in', 'out']),
        amount: z.number().positive().max(100_000_000),
        category: z.enum(TREASURY_CATEGORIES).refine((c) => c !== 'transfer' && c !== 'pos_difference', 'Use a transfer for cash ↔ bank'),
        occurred_on: zDate.optional(),
        label: z.string().trim().min(1).max(200),
        reference: z.string().trim().max(100).optional(),
    }),
    z.object({
        kind: z.literal('transfer'),
        from: z.enum(['cash', 'bank']),
        amount: z.number().positive().max(100_000_000),
        occurred_on: zDate.optional(),
        label: z.string().trim().max(200).optional(),
    }),
]);

export const POST = route('finance-treasury', async (request, actor) => {
    const body = await readBody(request, createSchema);
    if (body.kind === 'transfer') {
        const id = must(await supabase.rpc('record_cash_transfer', {
            p_from: body.from, p_amount: body.amount, p_date: body.occurred_on ?? null, p_label: body.label ?? '',
            p_actor: actor.userId, p_actor_email: actor.email,
        }));
        return ok({ transfer_id: id }, 201);
    }
    return ok(must(await supabase.from('treasury_movements').insert({
        account: body.account, direction: body.direction, amount: body.amount, category: body.category,
        occurred_on: body.occurred_on ?? new Date().toISOString().slice(0, 10), label: body.label, reference: body.reference || null,
        created_by: actor.userId, created_by_email: actor.email,
    }).select().single()), 201);
});

// DELETE ?id= — a movement entered by mistake (both sides of a transfer).
export const DELETE = route('finance-treasury', async (request) => {
    const id = params(request).get('id');
    if (!id) throw new HttpError('Missing id');
    return ok({ removed: must(await supabase.rpc('delete_treasury_movement', { p_id: id })) });
});
