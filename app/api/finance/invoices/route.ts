import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, ok, params, readBody, route, zDate, zId } from '@/lib/erp/api';

export const dynamic = 'force-dynamic';

/**
 * Sales invoices and credit notes. Numbers are sequential per year with no gaps (FA-2026-00001,
 * AV-2026-00001); an issued invoice is never edited or deleted: it is cancelled by a credit note.
 */

// GET ?id= (with the company details for printing) | ?order_id= | list: ?kind=&from=&to=&q=
export const GET = route('finance-invoices', async (request) => {
    const q = params(request);
    const id = q.get('id');
    if (id) {
        const [invoice, settings] = await Promise.all([
            supabase.from('sales_invoices').select('*, order:orders(order_number, created_at, delivered_at, payment_status)').eq('id', id).maybeSingle(),
            supabase.from('erp_settings').select('value').eq('key', 'accounting').maybeSingle(),
        ]);
        const row = must(invoice);
        if (!row) throw new HttpError('This invoice no longer exists.', 404);
        return ok({ ...row, company: (must(settings)?.value as { company?: unknown } | null)?.company ?? {} });
    }
    let query = supabase.from('sales_invoices').select('id, number, kind, order_id, credit_note_for, invoice_date, customer_name, customer_phone, amount_ht, vat_amount, stamp, total, status, created_at').is('deleted_at', null);
    if (q.get('order_id')) query = query.eq('order_id', q.get('order_id')!);
    if (q.get('kind')) query = query.eq('kind', q.get('kind')!);
    if (q.get('from')) query = query.gte('invoice_date', q.get('from')!);
    if (q.get('to')) query = query.lte('invoice_date', q.get('to')!);
    const term = q.get('q')?.replace(/[%,()]/g, ' ');
    if (term) query = query.or(`number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`);
    return ok(must(await query.order('created_at', { ascending: false }).limit(q.int('limit', 300, 2000))));
});

// POST { order_id, customer_tax_id?, invoice_date? } — issues the order's invoice.
export const POST = route('finance-invoices', async (request, actor) => {
    const body = await readBody(request, z.object({ order_id: zId, customer_tax_id: z.string().trim().max(50).optional(), invoice_date: zDate.optional() }));
    return ok(must(await supabase.rpc('issue_invoice', {
        p_order_id: body.order_id, p_customer_tax_id: body.customer_tax_id ?? null, p_date: body.invoice_date ?? null,
        p_actor: actor.userId, p_actor_email: actor.email,
    })), 201);
});

// PATCH { id, reason } — cancels an invoice with a credit note.
export const PATCH = route('finance-invoices', async (request, actor) => {
    const body = await readBody(request, z.object({ id: zId, reason: z.string().trim().max(500).optional() }));
    return ok(must(await supabase.rpc('cancel_invoice', { p_id: body.id, p_reason: body.reason ?? null, p_actor: actor.userId, p_actor_email: actor.email })));
});
