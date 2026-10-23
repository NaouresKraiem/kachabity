import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminActor, hasFullAccess, type AdminActor } from '@/lib/admin-auth';
import { reportError } from '@/lib/report-error';
import { stockErrorMessage } from '@/lib/stock';

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

type DbError = { message?: string; code?: string; details?: string };

// Exceptions raised by the database functions, as messages an admin can act on.
const DB_MESSAGES: [string, string, number][] = [
    ['unbalanced_entry', 'Debits and credits must be equal (and not zero).', 409],
    ['entry_posted', 'This entry is posted and can no longer change. Reverse it instead.', 409],
    ['entry_not_reversible', 'Only posted entries that were not reversed yet can be reversed.', 409],
    ['entry_not_found', 'This entry no longer exists.', 404],
    ['session_already_open', 'A till session is already open at this location.', 409],
    ['session_not_open', 'This till session is closed. Open a new one.', 409],
    ['payment_short', 'The payments do not cover the total.', 409],
    ['order_items_required', 'Add at least one product.', 400],
    ['purchase_order_not_open', 'Goods can only be received on an ordered purchase order.', 409],
    ['purchase_order_closed', 'This purchase order is received or cancelled; its lines can no longer change.', 409],
    ['purchase_order_not_found', 'This purchase order no longer exists.', 404],
    ['line_already_received', 'A line that already received goods cannot be removed.', 409],
    ['line_not_on_order', 'A received line is not on this purchase order.', 400],
    ['receipt_not_pending', 'This receipt was already validated or cancelled.', 409],
    ['receipt_not_found', 'This receipt no longer exists.', 404],
    ['receipt_location_required', 'Choose the location where the goods are stored.', 400],
    ['receipt_empty', 'Enter at least one received quantity.', 400],
    ['product_quantity_must_be_whole', 'Products are received in whole units.', 400],
    ['no_bill_of_materials', 'This product has no bill of materials yet.', 409],
    ['variant_not_found', 'This size/colour no longer exists.', 404],
    ['invalid_quantity', 'Enter a quantity above zero.', 400],
    ['material_not_found', 'This raw material no longer exists.', 404],
    ['invoice_exists', 'This order already has an invoice.', 409],
    ['order_not_invoiceable', 'Cancelled and returned orders cannot be invoiced.', 409],
    ['invoice_already_cancelled', 'This invoice is already cancelled.', 409],
    ['invoice_not_found', 'This invoice no longer exists.', 404],
    ['customer_has_open_orders', 'This customer still has orders in progress.', 409],
    ['same_customer', 'Choose two different customers.', 400],
    ['customer_not_found', 'This customer no longer exists.', 404],
    ['payments_not_open', 'Some payments were already paid out or removed. Reload and try again.', 409],
    ['order_not_found', 'Order not found', 404],
    ['invalid_status', 'Unknown order status.', 400],
    ['append_only', 'History cannot be edited; record a correcting movement instead.', 409],
    ['order_cancelled', 'This order is cancelled.', 409],
    ['invalid_account', 'Choose the till or the bank.', 400],
    ['remittance_not_found', 'This payout no longer exists.', 404],
    ['movement_not_found', 'This movement no longer exists.', 404],
    ['pos_difference_locked', 'Till differences come from closing a session and cannot be removed.', 409],
    ['product_not_found', 'This product no longer exists.', 404],
];

/** Message and status for an error raised by the database, or null when it isn't one we know. */
export function knownDbError(error: unknown): { message: string; status: number; code?: string } | null {
    const e = (error ?? {}) as DbError;
    const message = e.message ?? '';
    if (/insufficient_stock|no_online_location|variants_with_stock|negative_count|invalid_transfer/.test(message)) {
        return { message: stockErrorMessage(e), status: 409, code: 'STOCK' };
    }
    const material = message.match(/insufficient_material:([^:]+):(-?[\d.]+)/);
    if (material) return { message: `Not enough ${material[1]} in stock (${material[2]} left).`, status: 409, code: 'STOCK' };
    for (const [key, text, status] of DB_MESSAGES) {
        if (message.includes(key)) return { message: text, status, code: key.toUpperCase() };
    }
    if (e.code === '23505') return { message: 'This already exists.', status: 409, code: 'DUPLICATE' };
    if (e.code === '23503') return { message: 'This item is still in use elsewhere.', status: 409, code: 'IN_USE' };
    if (e.code === '23514') return { message: 'A value is out of range.', status: 400, code: 'INVALID' };
    if (e.code === '22P02') return { message: 'Invalid data', status: 400, code: 'INVALID' };
    return null;
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
