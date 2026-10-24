import { randomUUID } from 'crypto';
import { z } from 'zod';
import supabase from '@/lib/supabase-admin';
import { HttpError, must, ok, params, readBody, route, zDate, zId } from '@/lib/erp/api';
import { DOCUMENT_KINDS } from '@/lib/erp/constants';

export const dynamic = 'force-dynamic';

/**
 * Document archive (contracts, supplier invoices, delivery notes, certificates...). Files live in
 * the private `documents` bucket and are only reached through links that expire after 5 minutes.
 */

const MAX_SIZE = 20 * 1024 * 1024;
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/csv', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

// GET ?id=&download=1 (signed link) | list: ?kind=&related_type=&related_id=&q=
export const GET = route('finance-documents', async (request) => {
    const q = params(request);
    const id = q.get('id');
    if (id) {
        const doc = must(await supabase.from('documents').select('*').eq('id', id).is('deleted_at', null).maybeSingle());
        if (!doc) throw new HttpError('This document no longer exists.', 404);
        if (!q.bool('download')) return ok(doc);
        if (!doc.storage_path) throw new HttpError('This document has no file.', 404);
        const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 300, { download: doc.file_name ?? true });
        if (error) throw error;
        return ok({ url: data.signedUrl });
    }
    let query = supabase.from('documents').select('*').is('deleted_at', null);
    if (q.get('kind')) query = query.eq('kind', q.get('kind')!);
    if (q.get('related_type')) query = query.eq('related_type', q.get('related_type')!);
    if (q.get('related_id')) query = query.eq('related_id', q.get('related_id')!);
    const term = q.get('q')?.replace(/[%,()]/g, ' ');
    if (term) query = query.or(`title.ilike.%${term}%,partner_name.ilike.%${term}%,file_name.ilike.%${term}%`);
    return ok(must(await query.order('created_at', { ascending: false }).limit(q.int('limit', 300, 2000))));
});

const metaSchema = z.object({
    kind: z.enum(DOCUMENT_KINDS).default('other'),
    title: z.string().trim().min(1).max(200),
    related_type: z.string().trim().max(50).nullable().optional(),
    related_id: zId.nullable().optional(),
    partner_name: z.string().trim().max(150).nullable().optional(),
    document_date: zDate.nullable().optional(),
    expires_on: zDate.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
});

// POST multipart/form-data: file + the fields above.
export const POST = route('finance-documents', async (request, actor) => {
    const form = await request.formData();
    const file = form.get('file');
    const fields = Object.fromEntries([...form.entries()].filter(([k, v]) => k !== 'file' && typeof v === 'string' && v !== '').map(([k, v]) => [k, v]));
    const meta = metaSchema.parse(fields);
    let upload: { storage_path: string; file_name: string; mime_type: string; size_bytes: number } | null = null;
    if (file instanceof File && file.size > 0) {
        if (file.size > MAX_SIZE) throw new HttpError('Files are limited to 20 MB.');
        if (!ALLOWED.includes(file.type)) throw new HttpError('Upload a PDF, an image, a spreadsheet or a Word document.');
        const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-100);
        const path = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}-${safeName}`;
        const { error } = await supabase.storage.from('documents').upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        upload = { storage_path: path, file_name: file.name.slice(0, 200), mime_type: file.type, size_bytes: file.size };
    }
    return ok(must(await supabase.from('documents').insert({
        ...meta, ...(upload ?? {}), created_by: actor.userId, created_by_email: actor.email,
    }).select().single()), 201);
});

export const PUT = route('finance-documents', async (request) => {
    const body = await readBody(request, metaSchema.partial().extend({ id: zId }));
    const { id, ...row } = body;
    return ok(must(await supabase.from('documents').update(row).eq('id', id).is('deleted_at', null).select().single()));
});

// DELETE ?id= — archived as deleted; the file stays in storage until the record is purged.
export const DELETE = route('finance-documents', async (request) => {
    const id = params(request).get('id');
    if (!id) throw new HttpError('Missing id');
    must(await supabase.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', id));
    return ok({ id });
});
