import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, isManager, must, type Row, ok, params, readBody, route } from '@/lib/erp/api';
import { ACCOUNT_TYPES } from '@/lib/erp/constants';

export const dynamic = 'force-dynamic';

/**
 * Chart of accounts (Tunisian SCE structure) and the accounting settings: VAT, invoice stamp,
 * the date the books start, automatic posting, company details and which account each automatic
 * entry uses.
 */

// GET — accounts; ?settings=1 — the settings.
export const GET = route('finance-accounts', async (request) => {
    if (params(request).bool('settings')) {
        const row = must(await supabase.from('erp_settings').select('value, updated_at').eq('key', 'accounting').maybeSingle());
        return ok(row ?? { value: {} });
    }
    return ok(must(await supabase.from('accounts').select('*').is('deleted_at', null).order('code')));
});

const accountSchema = z.object({
    code: z.string().trim().regex(/^[1-7][0-9A-Za-z]{0,9}$/, 'Codes start with the class (1-7)'),
    name: z.string().trim().min(1).max(150),
    name_en: z.string().trim().max(150).nullable().optional(),
    name_ar: z.string().trim().max(150).nullable().optional(),
    type: z.enum(ACCOUNT_TYPES),
    is_active: z.boolean().default(true),
});

export const POST = route('finance-accounts', async (request) => {
    const body = await readBody(request, accountSchema);
    const existing = must(await supabase.from('accounts').select('code, deleted_at').eq('code', body.code).maybeSingle());
    if (existing && !existing.deleted_at) throw new HttpError('This account code already exists.', 409);
    if (existing) return ok(must(await supabase.from('accounts').update({ ...body, deleted_at: null }).eq('code', body.code).select().single()), 201);
    return ok(must(await supabase.from('accounts').insert(body).select().single()), 201);
});

export const PUT = route('finance-accounts', async (request) => {
    const body = await readBody(request, accountSchema.partial().required({ code: true }));
    const { code, ...row } = body;
    return ok(must(await supabase.from('accounts').update(row).eq('code', code).is('deleted_at', null).select().single()));
});

const settingsSchema = z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    auto_post: z.boolean(),
    vat_registered: z.boolean(),
    sales_vat_rate: z.number().min(0).max(100),
    invoice_stamp: z.number().min(0).max(100),
    company: z.object({
        name: z.string().trim().max(150), tax_id: z.string().trim().max(50), address: z.string().trim().max(300),
        phone: z.string().trim().max(50), email: z.string().trim().max(150), rc: z.string().trim().max(50),
    }).partial(),
    accounts: z.record(z.string(), z.string().regex(/^[1-7][0-9A-Za-z]*$/)),
}).partial();

// PATCH — settings (owners and admins, or finance staff for everything but the start date).
export const PATCH = route('finance-accounts', async (request, actor) => {
    const body = await readBody(request, settingsSchema);
    if (body.start_date && !isManager(actor)) throw new HttpError('Only owners and admins can move the start date of the books.', 403);
    if (body.accounts) {
        const codes = [...new Set(Object.values(body.accounts))];
        const known = must<Row[]>(await supabase.from('accounts').select('code').in('code', codes).is('deleted_at', null));
        const missing = codes.filter((c) => !known.some((k) => k.code === c));
        if (missing.length) throw new HttpError(`Unknown account(s): ${missing.join(', ')}`);
    }
    const current = must(await supabase.from('erp_settings').select('value').eq('key', 'accounting').maybeSingle());
    const value = (current?.value ?? {}) as Record<string, unknown>;
    const next = {
        ...value,
        ...body,
        company: { ...((value.company as object) ?? {}), ...(body.company ?? {}) },
        accounts: { ...((value.accounts as object) ?? {}), ...(body.accounts ?? {}) },
    };
    return ok(must(await supabase.from('erp_settings').upsert({ key: 'accounting', value: next }).select('value').single()));
});

// DELETE ?code= — accounts without entries that automatic entries don't use.
export const DELETE = route('finance-accounts', async (request) => {
    const code = params(request).get('code');
    if (!code) throw new HttpError('Missing code');
    const account = must(await supabase.from('accounts').select('is_system').eq('code', code).is('deleted_at', null).maybeSingle());
    if (!account) throw new HttpError('This account no longer exists.', 404);
    if (account.is_system) throw new HttpError('Automatic entries use this account; it can be renamed but not removed.', 409);
    const used = must(await supabase.from('journal_lines').select('id').eq('account_code', code).limit(1));
    if (used.length) throw new HttpError('This account has entries; deactivate it instead.', 409);
    must(await supabase.from('accounts').update({ deleted_at: new Date().toISOString() }).eq('code', code));
    return ok({ code });
});
