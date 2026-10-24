"use client";

import { useEffect, useState } from "react";
import { api } from "./erp-client";

export interface ItemOption {
    value: string;          // "v:<variant id>" or "m:<material id>"
    label: string;
    searchtext: string;
    unit: string;
    cost: number | null;    // last known cost (average)
}

interface InventoryRow {
    variant_id: string;
    sku: string | null;
    color: string | null;
    size: string | null;
    product_name: string;
    product_code: string | null;
}

interface Material {
    id: string;
    name: string;
    code: string | null;
    unit: string;
    avg_cost: number | null;
}

/** What can be bought: product variants (stock for sale) and raw materials, for purchase lines. */
export function usePurchaseItems() {
    const [items, setItems] = useState<ItemOption[]>([]);
    useEffect(() => {
        Promise.all([
            api<{ rows: InventoryRow[] }>("/api/stock/inventory").catch(() => ({ rows: [] as InventoryRow[] })),
            api<Material[]>("/api/purchasing/materials").catch(() => [] as Material[]),
        ]).then(([inventory, materials]) => {
            setItems([
                ...materials.map((m) => ({
                    value: `m:${m.id}`,
                    label: `🧵 ${m.name}${m.code ? ` · ${m.code}` : ""}`,
                    searchtext: `${m.name} ${m.code ?? ""}`,
                    unit: m.unit,
                    cost: m.avg_cost,
                })),
                ...inventory.rows.map((r) => {
                    const variant = [r.color, r.size].filter(Boolean).join(" / ");
                    return {
                        value: `v:${r.variant_id}`,
                        label: `${r.product_name}${variant ? ` · ${variant}` : ""}${r.sku ? ` · ${r.sku}` : ""}`,
                        searchtext: `${r.product_name} ${variant} ${r.sku ?? ""} ${r.product_code ?? ""}`,
                        unit: "unit",
                        cost: null,
                    };
                }),
            ]);
        });
    }, []);
    return items;
}
