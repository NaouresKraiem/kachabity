"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, Table, Typography, Space, Button, Tag, Empty } from "antd";
import { message } from "@/components/admin/antd-app";
import { DownloadOutlined, InboxOutlined } from "@ant-design/icons";
import { STATUS_LABELS } from "@/lib/stock";
import MovementModal, { type MovementPreset } from "@/components/admin/stock/MovementModal";
import { apiJson, downloadCsv, STATUS_COLORS, variantLabel, type Inventory, type InventoryRow } from "@/components/admin/stock/stock-client";
import { useAdminT } from "@/lib/admin-i18n";

const { Title, Text } = Typography;

/** Order enough to get back to twice the reorder point (at least 10 units on hand). */
const suggestedQuantity = (r: InventoryRow) => Math.max(Math.max(r.reorder_point * 2, 10) - r.online, 1);

export default function RestockPage() {
    const { t } = useAdminT();
    const [inventory, setInventory] = useState<Inventory>({ locations: [], rows: [] });
    const [loading, setLoading] = useState(true);
    const [preset, setPreset] = useState<MovementPreset | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setInventory(await apiJson<Inventory>("/api/stock/inventory"));
        } catch (e) {
            message.error(t((e as Error).message));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // Tracked variants at or below their reorder point at the online location, grouped by supplier.
    const groups = useMemo(() => {
        const low = inventory.rows.filter((r) => r.stock_tracked && (r.status === "low_stock" || r.status === "out_of_stock"));
        const bySupplier = new Map<string, { supplier: string; rows: InventoryRow[] }>();
        for (const r of low) {
            const key = r.supplier_id ?? "none";
            if (!bySupplier.has(key)) bySupplier.set(key, { supplier: r.supplier ?? t("No supplier"), rows: [] });
            bySupplier.get(key)!.rows.push(r);
        }
        return [...bySupplier.entries()].sort(([a], [b]) => (a === "none" ? 1 : b === "none" ? -1 : 0));
    }, [inventory.rows]);

    const online = inventory.locations.find((l) => l.sells_online);

    const receive = (rows: InventoryRow[]) => {
        setPreset({ type: "restock", locationId: online?.id, lines: rows.map((r) => ({ variant_id: r.variant_id, quantity: suggestedQuantity(r) })) });
        setModalOpen(true);
    };

    const exportList = (supplier: string, rows: InventoryRow[]) =>
        downloadCsv(
            `restock-${supplier.toLowerCase().replace(/\W+/g, "-")}.csv`,
            [t("Product"), t("Code"), t("Variant"), "SKU", t("On hand (online)"), t("Reorder point"), t("Suggested order")],
            rows.map((r) => [r.product_name, r.product_code, variantLabel(r), r.sku, r.online, r.reorder_point, suggestedQuantity(r)])
        );

    return (
        <Space orientation="vertical" size="large" style={{ width: "100%" }}>
            <div>
                <Title level={2} style={{ margin: 0 }}>{t("Restock")}</Title>
                <Text type="secondary">
                    {t("Tracked variants at or below their reorder point in {location}, grouped by supplier.", { location: online?.name ?? t("the online location") })}
                    Export a list to order, then record the delivery when it arrives.
                </Text>
            </div>

            {!loading && groups.length === 0 && (
                <Card><Empty description={t("Nothing to reorder. Only products you have counted and tracked appear here.")} /></Card>
            )}

            {groups.map(([key, group]) => (
                <Card
                    key={key}
                    loading={loading}
                    title={<Space>{group.supplier}<Tag>{t("{count} variants", { count: group.rows.length })}</Tag></Space>}
                    extra={
                        <Space>
                            <Button icon={<DownloadOutlined />} onClick={() => exportList(group.supplier, group.rows)}>{t("Export list")}</Button>
                            <Button type="primary" icon={<InboxOutlined />} onClick={() => receive(group.rows)}>{t("Record delivery")}</Button>
                        </Space>
                    }
                >
                    <Table
                        rowKey="variant_id"
                        size="small"
                        pagination={false}
                        dataSource={group.rows}
                        scroll={{ x: "max-content" }}
                        columns={[
                            {
                                title: t("Product"),
                                render: (_, r: InventoryRow) => (
                                    <div>
                                        <Link href={`/admin/products/${r.product_id}/edit`}>{r.product_name}</Link>
                                        <div><Text type="secondary" style={{ fontSize: 12 }}>{[variantLabel(r), r.sku].join(" · ")}</Text></div>
                                    </div>
                                ),
                            },
                            { title: t("On hand"), dataIndex: "online", align: "right" },
                            { title: t("Reorder point"), dataIndex: "reorder_point", align: "right" },
                            { title: t("Suggested order"), align: "right", render: (_, r: InventoryRow) => <strong style={{ color: "#389e0d" }}>+{suggestedQuantity(r)}</strong> },
                            { title: t("Status"), dataIndex: "status", render: (s: InventoryRow["status"]) => <Tag color={STATUS_COLORS[s]}>{t(STATUS_LABELS[s])}</Tag> },
                        ]}
                    />
                </Card>
            ))}

            <MovementModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSaved={load}
                rows={inventory.rows}
                locations={inventory.locations}
                preset={preset}
            />
        </Space>
    );
}
