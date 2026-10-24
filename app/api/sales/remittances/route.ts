import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, type Row, ok, params, readBody, route, zDate, zId, zMoney } from '@/lib/erp/api';

export const dynamic = 'force-dynamic';

/**
 * Payouts from the delivery company: the cash it collected on delivered parcels, less its fees,
 * arriving in the bank. Recording one takes the matching payments off what the carrier owes.
 */

// GET — payouts (newest first) and the payments the carrier still holds.
export const GET = route('sales-remittances', async (request) => {
    const q = params(request);
    const [remittances, open] = await Promise.all([
        supabase.from('cod_remittances').select('*, payments:order_payments(id, amount, order:orders(order_number))')
            .is('deleted_at', null).order('received_on', { ascending: false }).limit(q.int('limit', 100, 500)),
        supabase.from('order_payments')
            .select('id, amount, received_at, reference, order_id, order:orders(order_number, customer_first_name, customer_last_name, delivered_at)')
            .eq('account', 'carrier').is('remittance_id', null).is('deleted_at', null).order('received_at'),
    ]);
    return ok({ remittances: must(remittances), open_payments: must(open) });
});

const createSchema = z.object({
    payment_ids: z.array(zId).max(2000),
    // Cash the carrier collected for these parcels; defaults to the payments' total.
    gross_amount: zMoney.optional(),
    fees: zMoney.default(0),
    received_on: zDate.optional(),
    account: z.enum(['bank', 'cash']).default('bank'),
    provider: z.string().trim().max(50).default('colissimo'),
    reference: z.string().trim().max(200).optional(),
    note: z.string().trim().max(500).optional(),
});

export const POST = route('sales-remittances', async (request, actor) => {
    const body = await readBody(request, createSchema);
    let gross = body.gross_amount;
    if (gross === undefined) {
        if (!body.payment_ids.length) throw new HttpError('Choose the parcels this payout covers, or enter its amount.');
        const payments = must<Row[]>(await supabase.from('order_payments').select('amount').in('id', body.payment_ids));
        gross = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    }
    if (body.fees > (gross ?? 0)) throw new HttpError('Fees cannot be more than the payout.');
    const data = must(await supabase.rpc('record_remittance', {
        p_remittance: { provider: body.provider, reference: body.reference ?? '', received_on: body.received_on ?? '', gross_amount: gross, fees: body.fees, account: body.account, note: body.note ?? '' },
        p_payment_ids: body.payment_ids,
        p_actor: actor.userId,
        p_actor_email: actor.email,
    }));
    return ok(data, 201);
});

// DELETE ?id= — a payout entered by mistake: its parcels are owed by the carrier again.
export const DELETE = route('sales-remittances', async (request) => {
    const id = params(request).get('id');
    if (!id) throw new HttpError('Missing id');
    must(await supabase.rpc('cancel_remittance', { p_id: id }));
    return ok({ id });
});
