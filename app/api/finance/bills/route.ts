import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, ok, params, readBody, route, zDate, zId, zMoney } from '@/lib/erp/api';
import { BILL_CATEGORIES, BILL_CATEGORY_ACCOUNTS, FIXED_CATEGORIES } from '@/lib/erp/constants';

export const dynamic = 'force-dynamic';

/**
 * Bills: supplier invoices and every other expense (rent, salaries, utilities...), with due
 * dates and payments. Each bill books itself into the purchases journal; each payment into the
 * cash or bank journal.
 */

const SELECT = '*, supplier:suppliers(id, name, payment_terms_days), purchase_order:purchase_orders(id, number)';

// GET ?id= (with payments) | list: ?status=unpaid|partial|paid|open|overdue&category=&supplier_id=&from=&to=&cost_type=
export const GET = route('finance-bills', async (request) => {
    const q = params(request);
    const id = q.get('id');
    if (id) {
        const [bill, payments] = await Promise.all([
            supabase.from('bills').select(SELECT).eq('id', id).is('deleted_at', null).maybeSingle(),
            supabase.from('bill_payments').select('*').eq('bill_id', id).is('deleted_at', null).order('paid_on'),
        ]);
        const row = must(bill);
        if (!row) throw new HttpError('This bill no longer exists.', 404);
        return ok({ ...row, payments: must(payments) });
    }
    let query = supabase.from('bills').select(SELECT).is('deleted_at', null);
    const status = q.get('status');
    if (status === 'open') query = query.neq('status', 'paid');
    else if (status === 'overdue') query = query.neq('status', 'paid').lt('due_date', new Date().toISOString().slice(0, 10));
    else if (status) query = query.eq('status', status);
    if (q.get('category')) query = query.eq('category', q.get('category')!);
    if (q.get('cost_type')) query = query.eq('cost_type', q.get('cost_type')!);
    if (q.get('supplier_id')) query = query.eq('supplier_id', q.get('supplier_id')!);
    if (q.get('from')) query = query.gte('bill_date', q.get('from')!);
    if (q.get('to')) query = query.lte('bill_date', q.get('to')!);
    return ok(must(await query.order('bill_date', { ascending: false }).limit(q.int('limit', 500, 2000))));
});

const fields = {
    supplier_id: zId.nullable(),
    payee: z.string().trim().max(150).nullable(),
    purchase_order_id: zId.nullable(),
    supplier_reference: z.string().trim().max(100).nullable(),
    category: z.enum(BILL_CATEGORIES),
    cost_type: z.enum(['fixed', 'variable']),
    account_code: z.string().trim().regex(/^[1-7][0-9A-Za-z]*$/, 'Invalid account'),
    bill_date: zDate,
    due_date: zDate.nullable(),
    amount_ht: zMoney,
    vat_amount: zMoney,
    stamp: zMoney,
    notes: z.string().trim().max(2000).nullable(),
    document_id: zId.nullable(),
};

const createSchema = z.object(fields).partial().required({ category: true, amount_ht: true }).extend({
    // Paid on the spot (cash or bank): the payment is recorded with the bill.
    paid_now: z.object({ account: z.enum(['cash', 'bank']), method: z.enum(['cash', 'bank_transfer', 'check', 'card', 'other']) }).optional(),
});

async function dueDate(supplierId: string | null | undefined, billDate: string) {
    if (!supplierId) return null;
    const supplier = must(await supabase.from('suppliers').select('payment_terms_days').eq('id', supplierId).maybeSingle());
    const days = Number(supplier?.payment_terms_days ?? 0);
    const d = new Date(`${billDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

export const POST = route('finance-bills', async (request, actor) => {
    const body = await readBody(request, createSchema);
    const { paid_now, ...row } = body;
    if (!row.supplier_id && !row.payee) throw new HttpError('Choose a supplier or enter who is paid.');
    const billDate = row.bill_date ?? new Date().toISOString().slice(0, 10);
    const insert = {
        ...row,
        bill_date: billDate,
        account_code: row.account_code ?? BILL_CATEGORY_ACCOUNTS[row.category],
        cost_type: row.cost_type ?? (FIXED_CATEGORIES.includes(row.category) ? 'fixed' : 'variable'),
        due_date: row.due_date === undefined ? await dueDate(row.supplier_id, billDate) : row.due_date,
        created_by: actor.userId,
        created_by_email: actor.email,
    };
    if (!paid_now) return ok(must(await supabase.from('bills').insert(insert).select(SELECT).single()), 201);
    // Bill and payment together.
    const created = must(await supabase.rpc('create_paid_bill', {
        p_bill: insert, p_account: paid_now.account, p_method: paid_now.method, p_actor: actor.userId, p_actor_email: actor.email,
    })) as { id: string };
    return ok(must(await supabase.from('bills').select(SELECT).eq('id', created.id).single()), 201);
});

export const PUT = route('finance-bills', async (request) => {
    const body = await readBody(request, z.object({ id: zId, ...fields }).partial().required({ id: true }));
    const { id, ...row } = body;
    const current = must(await supabase.from('bills').select('paid_amount').eq('id', id).is('deleted_at', null).maybeSingle());
    if (!current) throw new HttpError('This bill no longer exists.', 404);
    const total = (row.amount_ht ?? 0) + (row.vat_amount ?? 0) + (row.stamp ?? 0);
    if (row.amount_ht !== undefined && total < Number(current.paid_amount) - 0.0005) {
        throw new HttpError('The new total is less than what was already paid.', 409);
    }
    return ok(must(await supabase.from('bills').update(row).eq('id', id).select(SELECT).single()));
});

const paySchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('pay'),
        bill_id: zId,
        amount: z.number().positive().max(100_000_000),
        paid_on: zDate.optional(),
        account: z.enum(['cash', 'bank']),
        method: z.enum(['cash', 'bank_transfer', 'check', 'card', 'other']),
        reference: z.string().trim().max(100).optional(),
        note: z.string().trim().max(500).optional(),
    }),
    z.object({ action: z.literal('unpay'), payment_id: zId }),
]);

// PATCH — pay a bill (part or all), or remove a payment entered by mistake.
export const PATCH = route('finance-bills', async (request, actor) => {
    const body = await readBody(request, paySchema);
    if (body.action === 'unpay') {
        must(await supabase.from('bill_payments').update({ deleted_at: new Date().toISOString() }).eq('id', body.payment_id).is('deleted_at', null));
        return ok({ id: body.payment_id });
    }
    const bill = must(await supabase.from('bills').select('total, paid_amount').eq('id', body.bill_id).is('deleted_at', null).maybeSingle());
    if (!bill) throw new HttpError('This bill no longer exists.', 404);
    if (body.amount > Number(bill.total) - Number(bill.paid_amount) + 0.0005) throw new HttpError('This is more than what is left to pay.', 409);
    return ok(must(await supabase.from('bill_payments').insert({
        bill_id: body.bill_id,
        amount: body.amount,
        paid_on: body.paid_on ?? new Date().toISOString().slice(0, 10),
        account: body.account,
        method: body.method,
        reference: body.reference || null,
        note: body.note || null,
        created_by: actor.userId,
        created_by_email: actor.email,
    }).select().single()), 201);
});

// DELETE ?id= — cancels a bill (its entry is reversed). Paid bills: remove the payments first.
export const DELETE = route('finance-bills', async (request) => {
    const id = params(request).get('id');
    if (!id) throw new HttpError('Missing id');
    const bill = must(await supabase.from('bills').select('paid_amount').eq('id', id).is('deleted_at', null).maybeSingle());
    if (!bill) throw new HttpError('This bill no longer exists.', 404);
    if (Number(bill.paid_amount) > 0) throw new HttpError('This bill has payments. Remove them first.', 409);
    must(await supabase.from('bills').update({ deleted_at: new Date().toISOString() }).eq('id', id));
    return ok({ id });
});
