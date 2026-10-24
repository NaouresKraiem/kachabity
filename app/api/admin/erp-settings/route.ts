import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { must, type Row, ok, readBody, route } from '@/lib/erp/api';

export const dynamic = 'force-dynamic';

/**
 * Business rules (owners and admins): sales alerts and duplicates, the till's discount limit, and the
 * analytics start date ("reset": figures count only from that day; nothing is deleted).
 */

export const GET = route('erp-settings', async () => {
    const rows = must<Row[]>(await supabase.from('erp_settings').select('key, value').in('key', KEYS));
    return ok(Object.fromEntries((rows ?? []).map((r) => [r.key, r.value])));
});

const schema = z.object({
    sales: z.object({
        pending_alert_hours: z.number().int().min(1).max(720),
        late_delivery_days: z.number().int().min(1).max(60),
        duplicate_window_days: z.number().int().min(1).max(365),
    }).partial().optional(),
    pos: z.object({ max_discount_percent: z.number().min(0).max(100) }).partial().optional(),
    analytics: z.object({ start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }).optional(),
});

const KEYS = ['sales', 'pos', 'analytics'] as const;

export const PUT = route('erp-settings', async (request) => {
    const body = await readBody(request, schema);
    const current = must<Row[]>(await supabase.from('erp_settings').select('key, value').in('key', KEYS));
    const byKey = Object.fromEntries((current ?? []).map((r) => [r.key, r.value as Record<string, unknown>]));
    const rows = KEYS
        .filter((key) => body[key])
        .map((key) => ({ key, value: { ...(byKey[key] ?? {}), ...body[key] } }));
    if (rows.length) must(await supabase.from('erp_settings').upsert(rows));
    return ok(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});
