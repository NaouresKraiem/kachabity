"use client";

import type { StockStatus } from "@/lib/stock";

export interface StockLocation {
    id: string;
    name: string;
    sells_online: boolean;
}

export interface InventoryRow {
    variant_id: string;
    sku: string | null;
    reorder_point: number;
    color: string | null;
    color_hex: string | null;
    size: string | null;
    size_order: number;
    product_id: string;
    product_name: string;
    product_name_ar: string | null;
    product_code: string | null;
    product_status: string;
    category: string | null;
    category_id: string | null;
    supplier: string | null;
    supplier_id: string | null;
    stock_tracked: boolean;
    /** The variant's own photo, or the product's main one. */
    image: string | null;
    product_image: string | null;
    levels: Record<string, number>;
    total: number;
    online: number;
    status: StockStatus;
}

export interface Inventory {
    locations: StockLocation[];
    rows: InventoryRow[];
}

export interface NamedRow {
    id: string;
    name: string;
}

export const STATUS_COLORS: Record<StockStatus, string> = {
    in_stock: "green",
    low_stock: "gold",
    out_of_stock: "red",
    untracked: "default",
};

export const MOVEMENT_COLORS: Record<string, string> = {
    restock: "green",
    return: "cyan",
    sale: "blue",
    adjustment: "purple",
    transfer: "geekblue",
};

export function variantLabel(row: Pick<InventoryRow, "color" | "size">): string {
    return [row.color, row.size].filter(Boolean).join(" / ") || "Default";
}

/** Fetches a JSON API route and returns `data`, throwing the route's error message on failure. */
export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Request failed (${res.status})`);
    }
    return json.data as T;
}

/** Downloads rows as a UTF-8 CSV (with BOM so Excel keeps Arabic text). */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
    const escape = (value: string | number | null | undefined) => {
        const text = value === null || value === undefined ? "" : String(value);
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
