"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, Table, Typography, Input, Select, Space, Button, Tag, Statistic, Row, Col, Tooltip } from "antd";
import { message } from "@/components/admin/antd-app";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import { STATUS_LABELS, type StockStatus } from "@/lib/stock";
import { useAdminRole } from "@/lib/admin-role-context";
import MovementModal from "@/components/admin/stock/MovementModal";
import ProductVariantsPanel from "@/components/admin/stock/ProductVariantsPanel";
import VariantThumb from "@/components/admin/stock/VariantThumb";
import { apiJson, downloadCsv, variantLabel, type Inventory, type InventoryRow } from "@/components/admin/stock/stock-client";
import { useAdminT } from "@/lib/admin-i18n";

const { Title, Text } = Typography;

// Stable object: MovementModal resets its form when the preset changes.
const RESTOCK_PRESET = { type: "restock" as const };

interface ProductGroup {
    product_id: string;
    product_name: string;
    product_name_ar: string | null;
    product_code: string | null;
    category: string | null;
    supplier: string | null;
    stock_tracked: boolean;
    image: string | null;
    variants: InventoryRow[];
    levels: Record<string, number>;
    total: number;
    low: number;
    out: number;
}

export default function InventoryPage() {
    const { t } = useAdminT();
    const canSeeCosts = useAdminRole().can("costs");
    const [inventory, setInventory] = useState<Inventory>({ locations: [], rows: [] });
    const [costs, setCosts] = useState<Map<string, number>>(new Map());
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<string | undefined>();
    const [supplier, setSupplier] = useState<string | undefined>();
    const [status, setStatus] = useState<StockStatus | undefined>();
    const [expanded, setExpanded] = useState<string[]>([]);
    const [movementOpen, setMovementOpen] = useState(false);

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

    useEffect(() => {
        if (!canSeeCosts) return;
        apiJson<{ product_id: string; cost: number }[]>("/api/stock/costs")
            .then((rows) => setCosts(new Map(rows.map((r) => [r.product_id, Number(r.cost)]))))
            .catch(() => undefined);
    }, [canSeeCosts]);

    const { rows, locations } = inventory;

    // One entry per product; a product is listed when any of its variants matches the filters.
    const products = useMemo(() => {
        const q = search.trim().toLowerCase();
        const groups = new Map<string, ProductGroup>();
        for (const r of rows) {
            let g = groups.get(r.product_id);
            if (!g) {
                g = {
                    product_id: r.product_id, product_name: r.product_name, product_name_ar: r.product_name_ar, product_code: r.product_code,
                    category: r.category, supplier: r.supplier, stock_tracked: r.stock_tracked, image: r.product_image ?? r.image,
                    variants: [], levels: {}, total: 0, low: 0, out: 0,
                };
                groups.set(r.product_id, g);
            }
            g.variants.push(r);
            for (const [loc, qty] of Object.entries(r.levels)) g.levels[loc] = (g.levels[loc] ?? 0) + qty;
            g.total += r.total;
            if (r.status === "low_stock") g.low += 1;
            if (r.status === "out_of_stock") g.out += 1;
        }
        return [...groups.values()].filter((g) => {
            const first = g.variants[0];
            if (category && first.category !== category) return false;
            if (supplier && first.supplier_id !== supplier) return false;
            if (status && !g.variants.some((v) => v.status === status)) return false;
            if (!q) return true;
            return [g.product_name, g.product_name_ar, g.product_code].some((v) => v?.toLowerCase().includes(q))
                || g.variants.some((v) => [v.sku, v.color, v.size].some((x) => x?.toLowerCase().includes(q)));
        });
    }, [rows, search, category, supplier, status]);

    const kpis = useMemo(() => {
        const tracked = rows.filter((r) => r.stock_tracked);
        return {
            units: rows.reduce((sum, r) => sum + r.total, 0),
            low: tracked.filter((r) => r.status === "low_stock").length,
            out: tracked.filter((r) => r.status === "out_of_stock").length,
            untracked: new Set(rows.filter((r) => !r.stock_tracked).map((r) => r.product_id)).size,
            value: rows.reduce((sum, r) => sum + r.total * (costs.get(r.product_id) ?? 0), 0),
        };
    }, [rows, costs]);

    const categories = useMemo(() => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort() as string[], [rows]);
    const suppliers = useMemo(() => {
        const map = new Map<string, string>();
        for (const r of rows) if (r.supplier_id && r.supplier) map.set(r.supplier_id, r.supplier);
        return [...map].map(([value, label]) => ({ value, label }));
    }, [rows]);

    const exportCsv = () => {
        downloadCsv(
            `inventory-${new Date().toISOString().slice(0, 10)}.csv`,
            [t("Product"), t("Code"), t("Variant"), "SKU", ...locations.map((l) => l.name), t("Total"), t("Reorder point"), t("Status")],
            products.flatMap((g) => g.variants).map((r) => [
                r.product_name, r.product_code, variantLabel(r), r.sku,
                ...locations.map((l) => r.levels[l.id] ?? 0),
                r.total, r.reorder_point, t(STATUS_LABELS[r.status]),
            ])
        );
    };

    const toggle = (productId: string) =>
        setExpanded((keys) => (keys.includes(productId) ? keys.filter((k) => k !== productId) : [...keys, productId]));

    const columns: ColumnsType<ProductGroup> = [
        {
            title: t("Product"),
            key: "product",
            render: (_, g) => (
                <Space>
                    <VariantThumb src={g.image} size={44} />
                    <div>
                        <strong>{g.product_name}</strong>
                        <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>{[g.product_code, g.category].filter(Boolean).join(" · ")}</Text>
                            {!g.stock_tracked && (
                                <Tooltip title={t("Not counted yet: the website keeps selling it whatever the stock says")}>
                                    <Tag style={{ marginInlineStart: 6, fontSize: 11 }}>{t("Not tracked")}</Tag>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                </Space>
            ),
        },
        { title: t("Variants"), key: "variants", align: "right", width: 90, render: (_, g) => g.variants.length },
        ...locations.map((l) => ({
            title: l.sells_online ? `${l.name} (online)` : l.name,
            key: l.id,
            align: "right" as const,
            sorter: (a: ProductGroup, b: ProductGroup) => (a.levels[l.id] ?? 0) - (b.levels[l.id] ?? 0),
            render: (_: unknown, g: ProductGroup) => g.levels[l.id] ?? 0,
        })),
        { title: t("Total"), key: "total", align: "right", sorter: (a, b) => a.total - b.total, render: (_, g) => <strong>{g.total}</strong> },
        {
            title: t("Status"),
            key: "status",
            render: (_, g) =>
                !g.stock_tracked ? (
                    <Tag>{t(STATUS_LABELS.untracked)}</Tag>
                ) : g.out || g.low ? (
                    <Space size={4} wrap>
                        {g.out > 0 && <Tag color="red">{t("{count} out", { count: g.out })}</Tag>}
                        {g.low > 0 && <Tag color="gold">{t("{count} low", { count: g.low })}</Tag>}
                    </Space>
                ) : (
                    <Tag color="green">{t(STATUS_LABELS.in_stock)}</Tag>
                ),
        },
        {
            key: "edit",
            width: 80,
            render: (_, g) => (
                <Link href={`/admin/products/${g.product_id}/edit`} onClick={(e) => e.stopPropagation()}>{t("Edit")}</Link>
            ),
        },
    ];

    return (
        <Space orientation="vertical" size="large" style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>{t("Inventory")}</Title>
                    <Text type="secondary">{t("Click a product to see its variants and change their stock. Website orders deduct from the online location when you validate them.")}</Text>
                </div>
                <Space wrap>
                    <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>{t("Refresh")}</Button>
                    <Button icon={<DownloadOutlined />} onClick={exportCsv}>{t("Export CSV")}</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setMovementOpen(true)}>{t("Record delivery or transfer")}</Button>
                </Space>
            </div>

            <Row gutter={[16, 16]}>
                <Col xs={12} md={canSeeCosts ? 4 : 6}><Card><Statistic title={t("Units in stock")} value={kpis.units} loading={loading} /></Card></Col>
                <Col xs={12} md={canSeeCosts ? 5 : 6}>
                    <Card hoverable onClick={() => setStatus(status === "low_stock" ? undefined : "low_stock")}>
                        <Statistic title={t("Low stock variants")} value={kpis.low} loading={loading} styles={{ content: { color: kpis.low ? "#d48806" : undefined } }} />
                    </Card>
                </Col>
                <Col xs={12} md={canSeeCosts ? 5 : 6}>
                    <Card hoverable onClick={() => setStatus(status === "out_of_stock" ? undefined : "out_of_stock")}>
                        <Statistic title={t("Out of stock variants")} value={kpis.out} loading={loading} styles={{ content: { color: kpis.out ? "#cf1322" : undefined } }} />
                    </Card>
                </Col>
                <Col xs={12} md={canSeeCosts ? 5 : 6}>
                    <Card hoverable onClick={() => setStatus(status === "untracked" ? undefined : "untracked")}>
                        <Statistic title={t("Products not counted yet")} value={kpis.untracked} loading={loading} />
                    </Card>
                </Col>
                {canSeeCosts && (
                    <Col xs={24} md={5}>
                        <Card><Statistic title={t("Stock value at cost")} value={kpis.value} precision={0} suffix="TND" loading={loading} /></Card>
                    </Col>
                )}
            </Row>

            <Card>
                <Space wrap style={{ marginBottom: 16 }}>
                    <Input.Search allowClear placeholder={t("Search product, SKU, color, size")} style={{ width: 300 }} onChange={(e) => setSearch(e.target.value)} />
                    <Select allowClear placeholder={t("Category")} style={{ width: 200 }} value={category} onChange={setCategory} options={categories.map((c) => ({ value: c, label: c }))} />
                    <Select allowClear placeholder={t("Supplier")} style={{ width: 180 }} value={supplier} onChange={setSupplier} options={suppliers} />
                    <Select
                        allowClear
                        placeholder={t("Status")}
                        style={{ width: 160 }}
                        value={status}
                        onChange={setStatus}
                        options={(Object.keys(STATUS_LABELS) as StockStatus[]).map((s) => ({ value: s, label: t(STATUS_LABELS[s]) }))}
                    />
                    <Text type="secondary">{t("{count} products", { count: products.length })}</Text>
                </Space>
                <Table
                    rowKey="product_id"
                    size="middle"
                    loading={loading}
                    columns={columns}
                    dataSource={products}
                    pagination={{ defaultPageSize: 25, showSizeChanger: true, pageSizeOptions: [25, 50, 100] }}
                    scroll={{ x: "max-content" }}
                    onRow={(g) => ({ onClick: () => toggle(g.product_id), style: { cursor: "pointer" } })}
                    expandable={{
                        expandedRowKeys: expanded,
                        onExpand: (_, g) => toggle(g.product_id),
                        expandedRowRender: (g) => <ProductVariantsPanel variants={g.variants} locations={locations} onSaved={load} />,
                    }}
                />
            </Card>

            <MovementModal
                open={movementOpen}
                onClose={() => setMovementOpen(false)}
                onSaved={load}
                rows={rows}
                locations={locations}
                preset={RESTOCK_PRESET}
            />
        </Space>
    );
}
