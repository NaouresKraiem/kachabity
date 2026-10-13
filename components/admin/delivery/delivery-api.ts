"use client";

/** A parcel as GET /api/delivery returns it. */
export interface Delivery {
    id: string;
    order_id: string | null;
    barcode: string | null;
    label_url: string | null;
    label_zebra_url: string | null;
    status: string;
    status_reason: string | null;
    status_changed_at: string | null;
    recipient_name: string | null;
    phone: string | null;
    governorate: string | null;
    city: string | null;
    cod_amount: number | null;
    items_count: number | null;
    designation: string | null;
    created_at: string;
    created_by_email: string | null;
    order: { id: string; order_number: string; customer_first_name: string; customer_last_name: string; status: string; total: number } | null;
}

export interface DeliveryList {
    rows: Delivery[];
    configured: { add: boolean; tracking: boolean };
}

interface ApiResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
    barcode?: string;
}

/** Calls /api/delivery; throws an Error with the server's message (and `code`) on failure. */
export async function deliveryApi<T>(init?: { method?: string; body?: unknown; query?: string }): Promise<T> {
    const response = await fetch(`/api/delivery${init?.query ? `?${init.query}` : ""}`, {
        method: init?.method ?? "GET",
        headers: init?.body ? { "Content-Type": "application/json" } : undefined,
        body: init?.body ? JSON.stringify(init.body) : undefined,
        cache: "no-store",
    });
    const result = (await response.json().catch(() => null)) as ApiResult<T> | null;
    if (!response.ok || !result?.success) {
        const error = new Error(result?.error || `Request failed (${response.status})`) as Error & { code?: string };
        error.code = result?.code;
        throw error;
    }
    return result.data as T;
}

export interface RefreshResult {
    checked: number;
    changed: number;
    failures: { barcode: string; error: string }[];
}
