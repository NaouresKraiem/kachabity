import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, type Row, ok, params, readBody, route, zDate, zId } from '@/lib/erp/api';
import { JOURNALS } from '@/lib/erp/constants';

export const dynamic = 'force-dynamic';

/**
 * Accounting journal. Entries come from the business automatically (sales at delivery, payments,
 * carrier payouts, bills, cash and bank movements, ad spend) as drafts; the accountant checks and
 * posts them, which numbers them and freezes them. Corrections are reversing entries.
 * Reports live in /api/finance/reports, the chart of accounts in /api/finance/accounts.
 */

const ENTRY_SELECT = 'id, journal, number, entry_date, label, source_type, source_id, source_event, status, posted_at, posted_by_email, reversal_of, reversed_at, created_by_email, created_at, lines:journal_lines(id, account_code, label, debit, credit, partner_type, partner_id, partner_name, position)';

// GET ?id= | list: ?journal=&status=&from=&to=&account=&q=&source_type=&page=&size=
export const GET = route('finance-accounting', async (request) => {
    const q = params(request);
    const id = q.get('id');
    if (id) {
        const entry = must(await supabase.from('journal_entries').select(ENTRY_SELECT).eq('id', id).is('deleted_at', null).maybeSingle());
        if (!entry) throw new HttpError('This entry no longer exists.', 404);
        return ok(entry);
    }
    const page = q.int('page', 1, 100_000);
    const size = q.int('size', 50, 500);
    const account = q.get('account');
    let query = supabase.from('journal_entries')
        .select(account ? ENTRY_SELECT.replace('lines:journal_lines(', 'lines:journal_lines!inner(') : ENTRY_SELECT, { count: 'exact' })
        .is('deleted_at', null);
    if (account) query = query.like('lines.account_code', `${account}%`);
    if (q.get('journal')) query = query.eq('journal', q.get('journal')!);
    if (q.get('status')) query = query.eq('status', q.get('status')!);
    if (q.get('source_type')) query = query.eq('source_type', q.get('source_type')!);
    if (q.get('from')) query = query.gte('entry_date', q.get('from')!);
    if (q.get('to')) query = query.lte('entry_date', q.get('to')!);
    const term = q.get('q')?.replace(/[%,()]/g, ' ');
    if (term) query = query.or(`label.ilike.%${term}%,number.ilike.%${term}%`);
    const { data, count, error } = await query
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false })
        .range((page - 1) * size, page * size - 1);
    if (error) throw error;
    const { count: drafts } = await supabase.from('journal_entries').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'draft');
    return ok({ rows: data ?? [], total: count ?? 0, page, size, drafts: drafts ?? 0 });
});

const lineSchema = z.object({
    account: z.string().trim().regex(/^[1-7][0-9A-Za-z]*$/, 'Invalid account'),
    label: z.string().trim().max(300).default(''),
    debit: z.number().min(0).max(1_000_000_000).default(0),
    credit: z.number().min(0).max(1_000_000_000).default(0),
    partner_name: z.string().trim().max(150).optional(),
});

const actionSchema = z.discriminatedUnion('action', [
    // Post (validate) drafts: by ids, or every draft up to a date.
    z.object({ action: z.literal('post'), ids: z.array(zId).max(5000).optional(), until: zDate.optional() }),
    // Create or edit (draft only) a hand-written entry.
    z.object({
        action: z.literal('save'),
        id: zId.optional(),
        journal: z.enum(JOURNALS),
        entry_date: zDate,
        label: z.string().trim().min(1).max(300),
        lines: z.array(lineSchema).min(2).max(200),
    }),
    z.object({ action: z.literal('reverse'), id: zId, date: zDate.optional() }),
    // Remove a draft (automatic drafts come back if their event happens again).
    z.object({ action: z.literal('discard'), id: zId }),
    // Period end: bring the stock accounts to the stock's value.
    z.object({ action: z.literal('stock_variation'), date: zDate }),
]);

export const POST = route('finance-accounting', async (request, actor) => {
    const body = await readBody(request, actionSchema);
    if (body.action === 'post') {
        let ids = body.ids ?? [];
        if (!body.ids) {
            let query = supabase.from('journal_entries').select('id').eq('status', 'draft').is('deleted_at', null);
            if (body.until) query = query.lte('entry_date', body.until);
            ids = (must<Row[]>(await query.limit(5000)) ?? []).map((e) => e.id);
        }
        if (!ids.length) return ok({ posted: 0 });
        return ok({ posted: must(await supabase.rpc('post_journal_entries', { p_ids: ids, p_actor: actor.userId, p_actor_email: actor.email })) });
    }
    if (body.action === 'save') {
        const debit = body.lines.reduce((s, l) => s + l.debit, 0);
        const credit = body.lines.reduce((s, l) => s + l.credit, 0);
        if (Math.abs(debit - credit) > 0.0005 || debit === 0) throw new HttpError('Debits and credits must be equal (and not zero).');
        const accounts = [...new Set(body.lines.map((l) => l.account))];
        const known = must<Row[]>(await supabase.from('accounts').select('code').in('code', accounts).is('deleted_at', null));
        const missing = accounts.filter((a) => !known.some((k) => k.code === a));
        if (missing.length) throw new HttpError(`Unknown account(s): ${missing.join(', ')}. Add them to the chart of accounts first.`);
        return ok(must(await supabase.rpc('save_manual_entry', {
            p_id: body.id ?? null,
            p_entry: { journal: body.journal, entry_date: body.entry_date, label: body.label },
            p_lines: body.lines,
            p_actor: actor.userId,
            p_actor_email: actor.email,
        })), body.id ? 200 : 201);
    }
    if (body.action === 'reverse') {
        return ok({ id: must(await supabase.rpc('reverse_journal_entry', { p_id: body.id, p_date: body.date ?? null, p_actor: actor.userId, p_actor_email: actor.email })) });
    }
    if (body.action === 'discard') {
        const entry = must(await supabase.from('journal_entries').select('status').eq('id', body.id).is('deleted_at', null).maybeSingle());
        if (!entry) throw new HttpError('This entry no longer exists.', 404);
        if (entry.status !== 'draft') throw new HttpError('This entry is posted and can no longer change. Reverse it instead.', 409);
        must(await supabase.from('journal_entries').update({ deleted_at: new Date().toISOString() }).eq('id', body.id));
        return ok({ id: body.id });
    }
    return ok(must(await supabase.rpc('book_stock_variation', { p_date: body.date, p_actor: actor.userId, p_actor_email: actor.email })));
});
