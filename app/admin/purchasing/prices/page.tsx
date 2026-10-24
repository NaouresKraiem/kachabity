"use client";

import { useMemo, useState } from "react";
import { Card, Input, Table, Tag, Typography } from "antd";
import { useAdminT } from "@/lib/admin-i18n";
import { PageHeader } from "@/components/admin/erp/ui";
import { formatDate, formatMoney, useApi } from "@/components/admin/erp/erp-client";

const { Text } = Typography;

interface PriceRow {
    item_key: string;
    item_name: string;
    supplier_id: string;
    supplier_name: string;
    last_unit_cost: number;
    min_unit_cost: number;
    avg_unit_cost: number;
    times: number;
    total_quantity: number;
    last_date: string;
}

/**
 * Admin → Price comparison: for each item bought (products and raw materials), what each supplier
 * charged (quotes and orders), cheapest first. The cheapest supplier is tagged.
 */
export default function PriceComparisonPage() {
    const { t, locale } = useAdminT();
    const { data, loading } = useApi<PriceRow[]>("/api/purchasing/prices");
    const [search, setSearch] = useState("");
    const supplierFilter = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("supplier") : null;

    const rows = useMemo(() => {
        const term = search.toLowerCase();
        const list = (data ?? []).filter((r) => (!term || r.item_name.toLowerCase().includes(term) || r.supplier_name.toLowerCase().includes(term)));
        const best = new Map<string, number>();
        for (const r of list) best.set(r.item_key, Math.min(best.get(r.item_key) ?? Infinity, Number(r.last_unit_cost)));
        const suppliersPerItem = new Map<string, number>();
        for (const r of list) suppliersPerItem.set(r.item_key, (suppliersPerItem.get(r.item_key) ?? 0) + 1);
        return list
            .filter((r) => !supplierFilter || r.supplier_id === supplierFilter)
            .map((r) => ({ ...r, cheapest: suppliersPerItem.get(r.item_key)! > 1 && Number(r.last_unit_cost) === best.get(r.item_key), gap: Number(r.last_unit_cost) - (best.get(r.item_key) ?? 0) }));
    }, [data, search, supplierFilter]);

    const money = (n: number) => formatMoney(n, locale);

    return (
        <div>
            <PageHeader title={t("Price comparison")} subtitle={t("What each supplier charged for the same item, from your price requests and orders.")} crumbs={[{ title: t("Purchase orders"), href: "/admin/purchasing" }]} />
            <Card>
                <Input.Search allowClear placeholder={t("Search item or supplier")} value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 320, marginBottom: 16 }} />
                <Table
                    rowKey={(r) => `${r.item_key}:${r.supplier_id}`}
                    loading={loading}
                    dataSource={rows}
                    scroll={{ x: "max-content" }}
                    pagination={{ pageSize: 50 }}
                    locale={{ emptyText: t("No purchases or price requests yet.") }}
                    columns={[
                        { title: t("Item"), dataIndex: "item_name" },
                        { title: t("Supplier"), dataIndex: "supplier_name", render: (v: string, r) => <span>{v} {r.cheapest && <Tag color="green">{t("Cheapest")}</Tag>}</span> },
                        { title: t("Last price"), dataIndex: "last_unit_cost", align: "right", render: (v: number, r) => <span>{money(v)}{r.gap > 0 && <Text type="danger" style={{ fontSize: 12 }}> (+{money(r.gap)})</Text>}</span> },
                        { title: t("Lowest"), dataIndex: "min_unit_cost", align: "right", render: (v: number) => money(v) },
                        { title: t("Average"), dataIndex: "avg_unit_cost", align: "right", render: (v: number) => money(v) },
                        { title: t("Times"), dataIndex: "times", align: "right" },
                        { title: t("Quantity bought"), dataIndex: "total_quantity", align: "right" },
                        { title: t("Last time"), dataIndex: "last_date", render: (v: string) => formatDate(v, locale) },
                    ]}
                />
            </Card>
        </div>
    );
}
