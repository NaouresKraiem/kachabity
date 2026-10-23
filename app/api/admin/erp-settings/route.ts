import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { must, type Row, ok, readBody, route } from '@/lib/erp/api';

export const dynamic = 'force-dynamic';

/** Business rules (owners and admins): sales alerts and duplicates, and the till's discount limit. */

export const GET = route('erp-settings', async () => {
    const rows = must<Row[]>(await supabase.from('erp_settings').select('key, value').in('key', ['sales', 'pos']));
    return ok(Object.fromEntries((rows ?? []).map((r) => [r.key, r.value])));
});

const schema = z.object({
    sales: z.object({
        pending_alert_hours: z.number().int().min(1).max(720),
        late_delivery_days: z.number().int().min(1).max(60),
        duplicate_window_days: z.number().int().min(1).max(365),
    }).partial().optional(),
    pos: z.object({ max_discount_percent: z.number().min(0).max(100) }).partial().optional(),
});

export const PUT = route('erp-settings', async (request) => {
    const body = await readBody(request, schema);
    const current = must<Row[]>(await supabase.from('erp_settings').select('key, value').in('key', ['sales', 'pos']));
    const byKey = Object.fromEntries((current ?? []).map((r) => [r.key, r.value as Record<string, unknown>]));
    const rows = (['sales', 'pos'] as const)
        .filter((key) => body[key])
        .map((key) => ({ key, value: { ...(byKey[key] ?? {}), ...body[key] } }));
    if (rows.length) must(await supabase.from('erp_settings').upsert(rows));
    return ok(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});
