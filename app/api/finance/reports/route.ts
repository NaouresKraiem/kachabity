import { NextResponse } from 'next/server';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, ok, params, route } from '@/lib/erp/api';

export const dynamic = 'force-dynamic';

/**
 * Accounting reports for a period (?from=YYYY-MM-DD&to=YYYY-MM-DD&drafts=1 to include drafts):
 *   ?report=trial       trial balance (balance before, movements, balance after, per account)
 *   ?report=ledger      general ledger of one account (&account=), with running balance
 *   ?report=income      income statement (classes 6 and 7)
 *   ?report=balance     balance sheet at `to` (classes 1–5, with the result of the year)
 *   ?report=vat         VAT collected / deductible / due per month
 *   ?report=export      every line as CSV for the accountant's software (FEC-style columns)
 */

interface TrialRow {
    account_code: string;
    account_name: string;
    account_class: number;
    account_type: string;
    opening: number;
    debit: number;
    credit: number;
    closing: number;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

function csvCell(value: unknown) {
    const text = value === null || value === undefined ? '' : String(value);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const GET = route('finance-reports', async (request) => {
    const q = params(request);
    const today = new Date().toISOString().slice(0, 10);
    const to = q.get('to') ?? today;
    const from = q.get('from') ?? `${to.slice(0, 4)}-01-01`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new HttpError('Invalid period');
    const drafts = q.bool('drafts');
    const report = q.get('report') ?? 'trial';

    if (report === 'vat') {
        return ok(must(await supabase.rpc('vat_summary', { p_from: from, p_to: to, p_include_drafts: drafts })));
    }

    if (report === 'ledger') {
        const account = q.get('account');
        if (!account) throw new HttpError('Choose an account');
        const [before, lines] = await Promise.all([
            supabase.rpc('trial_balance', { p_from: from, p_to: to, p_include_drafts: drafts }),
            supabase.from('journal_lines')
                .select('id, account_code, label, debit, credit, partner_name, entry:journal_entries!inner(id, journal, number, entry_date, label, status, deleted_at)')
                .eq('account_code', account).is('entry.deleted_at', null)
                .gte('entry.entry_date', from).lte('entry.entry_date', to)
                .limit(5000),
        ]);
        const opening = Number((must(before) as TrialRow[]).find((r) => r.account_code === account)?.opening ?? 0);
        type L = { id: string; label: string; debit: number; credit: number; partner_name: string | null; entry: { id: string; journal: string; number: string | null; entry_date: string; label: string; status: string } };
        const rows = (must(lines) as unknown as L[])
            .filter((l) => drafts || l.entry.status === 'posted')
            .sort((a, b) => a.entry.entry_date.localeCompare(b.entry.entry_date) || (a.entry.number ?? '').localeCompare(b.entry.number ?? ''));
        let balance = opening;
        return ok({
            account,
            opening,
            lines: rows.map((l) => {
                balance = round(balance + Number(l.debit) - Number(l.credit));
                return { ...l, balance };
            }),
            closing: balance,
        });
    }

    const trial = (must(await supabase.rpc('trial_balance', { p_from: from, p_to: to, p_include_drafts: drafts })) as TrialRow[])
        .map((r) => ({ ...r, opening: Number(r.opening), debit: Number(r.debit), credit: Number(r.credit), closing: Number(r.closing) }));

    if (report === 'trial') {
        const totals = trial.reduce((t, r) => ({ debit: t.debit + r.debit, credit: t.credit + r.credit }), { debit: 0, credit: 0 });
        return ok({ rows: trial, totals: { debit: round(totals.debit), credit: round(totals.credit) } });
    }

    if (report === 'income') {
        // Movements of the period only; income shown positive, expenses positive.
        const income = trial.filter((r) => r.account_class === 7).map((r) => ({ code: r.account_code, name: r.account_name, amount: round(r.credit - r.debit) }));
        const expenses = trial.filter((r) => r.account_class === 6).map((r) => ({ code: r.account_code, name: r.account_name, amount: round(r.debit - r.credit) }));
        const totalIncome = round(income.reduce((s, r) => s + r.amount, 0));
        const totalExpenses = round(expenses.reduce((s, r) => s + r.amount, 0));
        return ok({ income, expenses, total_income: totalIncome, total_expenses: totalExpenses, result: round(totalIncome - totalExpenses) });
    }

    if (report === 'balance') {
        // Balances at `to`: everything since the beginning of the books.
        const all = (must(await supabase.rpc('trial_balance', { p_from: '1900-01-01', p_to: to, p_include_drafts: drafts })) as TrialRow[])
            .map((r) => ({ ...r, closing: Number(r.closing) }));
        const result = round(-all.filter((r) => r.account_class >= 6).reduce((s, r) => s + r.closing, 0));
        const assets = all.filter((r) => r.account_class <= 5 && r.closing > 0.0005).map((r) => ({ code: r.account_code, name: r.account_name, amount: round(r.closing) }));
        const liabilities = all.filter((r) => r.account_class <= 5 && r.closing < -0.0005).map((r) => ({ code: r.account_code, name: r.account_name, amount: round(-r.closing) }));
        const totalAssets = round(assets.reduce((s, r) => s + r.amount, 0));
        const totalLiabilities = round(liabilities.reduce((s, r) => s + r.amount, 0));
        return ok({ assets, liabilities, result, total_assets: totalAssets, total_liabilities_and_equity: round(totalLiabilities + result) });
    }

    if (report === 'export') {
        const lines = must(await supabase.from('journal_lines')
            .select('account_code, label, debit, credit, partner_type, partner_id, partner_name, account:accounts(name), entry:journal_entries!inner(journal, number, entry_date, label, status, posted_at, deleted_at, source_type)')
            .is('entry.deleted_at', null).gte('entry.entry_date', from).lte('entry.entry_date', to)
            .limit(100_000)) as unknown as {
                account_code: string; label: string; debit: number; credit: number; partner_type: string | null; partner_id: string | null; partner_name: string | null;
                account: { name: string } | null;
                entry: { journal: string; number: string | null; entry_date: string; label: string; status: string; posted_at: string | null; source_type: string };
            }[];
        const journalNames: Record<string, string> = { VT: 'Ventes', AC: 'Achats', CA: 'Caisse', BQ: 'Banque', OD: 'Opérations diverses' };
        const header = ['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 'ValidDate', 'Statut'];
        const rows = lines
            .filter((l) => drafts || l.entry.status === 'posted')
            .sort((a, b) => a.entry.entry_date.localeCompare(b.entry.entry_date) || (a.entry.number ?? '').localeCompare(b.entry.number ?? ''))
            .map((l) => [
                l.entry.journal, journalNames[l.entry.journal] ?? l.entry.journal, l.entry.number ?? 'BROUILLON', l.entry.entry_date.replace(/-/g, ''),
                l.account_code, l.account?.name ?? '', l.partner_id ?? '', l.partner_name ?? '', l.entry.source_type, l.entry.entry_date.replace(/-/g, ''),
                l.label || l.entry.label, Number(l.debit).toFixed(3).replace('.', ','), Number(l.credit).toFixed(3).replace('.', ','),
                l.entry.posted_at ? l.entry.posted_at.slice(0, 10).replace(/-/g, '') : '', l.entry.status,
            ].map(csvCell).join(';'));
        const csv = '﻿' + [header.join(';'), ...rows].join('\r\n');
        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="ecritures-${from}-${to}.csv"`,
            },
        });
    }

    throw new HttpError('Unknown report');
});
