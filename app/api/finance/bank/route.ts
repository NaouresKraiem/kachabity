import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, type Row, ok, params, readBody, route, zDate, zId } from '@/lib/erp/api';

export const dynamic = 'force-dynamic';

/**
 * Bank reconciliation: the bank statement's lines (imported from the bank's CSV export or typed)
 * are matched one-to-one with the bank account's lines in the books. What stays unmatched on
 * either side is what to look into.
 */

// GET — statement lines, bank lines of the books not matched yet, and both balances (?from=&to=).
export const GET = route('finance-bank', async (request) => {
    const q = params(request);
    const settings = must(await supabase.from('erp_settings').select('value').eq('key', 'accounting').maybeSingle());
    const bankAccount = ((settings?.value as { accounts?: Record<string, string> } | null)?.accounts?.bank) ?? '532';
    let statement = supabase.from('bank_statement_lines')
        .select('*, matched:journal_lines(id, label, debit, credit, entry:journal_entries(number, entry_date, label))')
        .is('deleted_at', null);
    if (q.get('from')) statement = statement.gte('statement_date', q.get('from')!);
    if (q.get('to')) statement = statement.lte('statement_date', q.get('to')!);
    const [lines, books, matchedIds] = await Promise.all([
        statement.order('statement_date', { ascending: false }).limit(2000),
        supabase.from('journal_lines')
            .select('id, label, debit, credit, entry:journal_entries!inner(id, number, entry_date, label, status, deleted_at)')
            .eq('account_code', bankAccount).is('entry.deleted_at', null).limit(5000),
        supabase.from('bank_statement_lines').select('matched_line_id').not('matched_line_id', 'is', null).is('deleted_at', null),
    ]);
    const matched = new Set((must<Row[]>(matchedIds) ?? []).map((m) => m.matched_line_id));
    type BookLine = { id: string; label: string; debit: number; credit: number; entry: { number: string | null; entry_date: string; label: string; status: string } };
    const bookLines = must(books) as unknown as BookLine[];
    const statementLines = must<Row[]>(lines) ?? [];
    return ok({
        account: bankAccount,
        statement: statementLines,
        unmatched_books: bookLines.filter((l) => !matched.has(l.id)).sort((a, b) => b.entry.entry_date.localeCompare(a.entry.entry_date)),
        balance_books: Math.round(bookLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0) * 1000) / 1000,
        balance_statement: Math.round(statementLines.reduce((s, l) => s + Number(l.amount), 0) * 1000) / 1000,
    });
});

const importSchema = z.object({
    batch: z.string().trim().max(100).optional(),
    lines: z.array(z.object({
        statement_date: zDate,
        label: z.string().trim().max(300).default(''),
        amount: z.number().finite().refine((v) => v !== 0, 'Amount cannot be zero'),
        reference: z.string().trim().max(100).optional(),
    })).min(1).max(2000),
});

// POST — adds statement lines (CSV parsed in the browser, or one typed line), then auto-matches.
export const POST = route('finance-bank', async (request, actor) => {
    const body = await readBody(request, importSchema);
    const batch = body.batch || `import-${new Date().toISOString()}`;
    const inserted = must(await supabase.from('bank_statement_lines').insert(body.lines.map((l) => ({
        ...l, reference: l.reference || null, import_batch: batch, created_by: actor.userId, created_by_email: actor.email,
    }))).select('id'));
    const matched = must(await supabase.rpc('auto_match_bank', { p_days: 5, p_actor: actor.userId }));
    return ok({ imported: inserted.length, matched }, 201);
});

// PATCH — { action: match, statement_id, line_id } | { action: unmatch, statement_id } | { action: auto, days }
export const PATCH = route('finance-bank', async (request, actor) => {
    const body = await readBody(request, z.discriminatedUnion('action', [
        z.object({ action: z.literal('match'), statement_id: zId, line_id: zId }),
        z.object({ action: z.literal('unmatch'), statement_id: zId }),
        z.object({ action: z.literal('auto'), days: z.number().int().min(0).max(31).default(5) }),
    ]));
    if (body.action === 'auto') return ok({ matched: must(await supabase.rpc('auto_match_bank', { p_days: body.days, p_actor: actor.userId })) });
    if (body.action === 'unmatch') {
        must(await supabase.from('bank_statement_lines').update({ matched_line_id: null, matched_at: null, matched_by: null }).eq('id', body.statement_id));
        return ok({ id: body.statement_id });
    }
    const taken = must(await supabase.from('bank_statement_lines').select('id').eq('matched_line_id', body.line_id).is('deleted_at', null).maybeSingle());
    if (taken) throw new HttpError('This line of the books is already matched.', 409);
    return ok(must(await supabase.from('bank_statement_lines')
        .update({ matched_line_id: body.line_id, matched_at: new Date().toISOString(), matched_by: actor.userId })
        .eq('id', body.statement_id).select().single()));
});

export const DELETE = route('finance-bank', async (request) => {
    const id = params(request).get('id');
    if (!id) throw new HttpError('Missing id');
    must(await supabase.from('bank_statement_lines').update({ deleted_at: new Date().toISOString(), matched_line_id: null }).eq('id', id));
    return ok({ id });
});
