"use client";

import { apiJson } from "@/components/admin/stock/stock-client";

/**
 * Admin wording for order statuses. "processing" is shown as "Validated": validating an order
 * confirms it and takes its items out of the online location's stock (tracked products).
 * Later, validating will also hand the order to the delivery company.
 */
export const ORDER_STATUS_LABELS: Record<string, string> = {
    pending: "Pending",
    processing: "Validated",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
    pending: "orange",
    processing: "blue",
    shipped: "cyan",
    delivered: "green",
    cancelled: "red",
};

export const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label }));

export const orderStatusLabel = (status: string) => ORDER_STATUS_LABELS[status] ?? status;

/** Validates a pending order. Throws with a readable message, e.g. when stock is short. */
export async function validateOrder(orderId: string) {
    return apiJson<{ status: string; stock_deducted: boolean }>("/api/orders", {
        method: "PUT",
        body: JSON.stringify({ id: orderId, status: "processing" }),
    });
}
