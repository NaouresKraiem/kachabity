import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminActor, hasFullAccess, type AdminActor } from '@/lib/admin-auth';
import { reportError } from '@/lib/report-error';
import { knownDbError } from '@/lib/erp/db-messages';

/**
 * Shared plumbing for the back-office ERP routes (sales, customers, purchasing, till, finance).
 * Middleware has already checked who may call them; handlers get the verified actor.
 * Responses are { success, data } or { success: false, error, code? }. Error texts are English
 * and the admin translates them with t().
 */

export const ok = (data: unknown, status = 200) => NextResponse.json({ success: true, data }, { status });

export const fail = (error: string, status = 400, code?: string) =>
    NextResponse.json({ success: false, error, ...(code ? { code } : {}) }, { status });

/** A refusal to send back as is. */
export class HttpError extends Error {
    constructor(message: string, public status = 400, public code?: string) {
        super(message);
    }
}

/**
 * Wraps a route handler: validation errors (zod), HttpError and known database errors become
 * 4xx responses; anything else is logged, reported to Sentry and answered with a 500.
 */
export function route(area: string, handler: (request: NextRequest, actor: AdminActor) => Promise<NextResponse>) {
    return async (request: NextRequest) => {
        try {
            return await handler(request, getAdminActor(request.headers));
        } catch (error) {
            if (error instanceof z.ZodError) {
                const issue = error.issues[0];
                return fail(issue ? `${issue.path.join('.') || 'data'}: ${issue.message}` : 'Invalid data', 400, 'INVALID');
            }
            if (error instanceof HttpError) return fail(error.message, error.status, error.code);
            const known = knownDbError(error);
            if (known) return fail(known.message, known.status, known.code);
            console.error(`Error in ${area}:`, error);
            reportError(error, area, { method: request.method });
            return fail('Something went wrong. Please try again.', 500);
        }
    };
}

/** Parses the JSON body with a schema (throws a ZodError the wrapper turns into a 400). */
export async function readBody<T extends z.ZodType>(request: NextRequest, schema: T): Promise<z.infer<T>> {
    let json: unknown;
    try {
        json = await request.json();
    } catch {
        throw new HttpError('Invalid JSON body');
    }
    return schema.parse(json);
}

/**
 * The data of a supabase-js result, throwing its error. The project's client has no generated
 * database types, so rows are `any`; callers cast where they need a shape.
 */
export function must<T = any>(result: { data: any; error: unknown }): T {
    if (result.error) throw result.error;
    return result.data as T;
}

/** A database row as returned by the untyped client. */
export type Row = Record<string, any>;

/** Owners and admins can do anything in an area; this tells staff from them. */
export const isManager = (actor: AdminActor) => hasFullAccess(actor.role);

/** Search parameter helpers. */
export function params(request: NextRequest) {
    const sp = request.nextUrl.searchParams;
    return {
        get: (name: string) => sp.get(name)?.trim() || null,
        int: (name: string, fallback: number, max = 1000) => {
            const value = Number(sp.get(name));
            return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), max) : fallback;
        },
        list: (name: string) => (sp.get(name) ?? '').split(',').map((v) => v.trim()).filter(Boolean),
        bool: (name: string) => sp.get(name) === 'true' || sp.get(name) === '1',
    };
}

/** Period from ?from=&to= (ISO), defaulting to the last `days` days. */
export function period(request: NextRequest, days = 30) {
    const sp = request.nextUrl.searchParams;
    const to = sp.get('to') ? new Date(sp.get('to')!) : new Date();
    const from = sp.get('from') ? new Date(sp.get('from')!) : new Date(to.getTime() - days * 86_400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) throw new HttpError('Invalid period');
    return { from, to };
}

/** YYYY-MM-DD of a date in Tunis time (the business's calendar). */
export const tunisDay = (date: Date = new Date()) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

/** Shared zod pieces. */
export const zMoney = z.number().finite().nonnegative().max(100_000_000);
export const zId = z.guid();
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const zText = (max = 500) => z.string().trim().max(max);
