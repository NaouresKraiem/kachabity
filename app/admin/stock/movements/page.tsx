"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Table, Typography, Input, Select, Space, Button, Tag } from "antd";
import { message } from "@/components/admin/antd-app";
import type { ColumnsType } from "antd/es/table";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { MOVEMENT_LABELS, MOVEMENT_TYPES, type MovementType } from "@/lib/stock";
import { apiJson, downloadCsv, MOVEMENT_COLORS, type NamedRow } from "@/components/admin/stock/stock-client";
import { useAdminT } from "@/lib/admin-i18n";

const { Title, Text } = Typography;

interface Movement {
    id: string;
    type: MovementType;
    quantity: number;
    sku: string;
    product_name: string;
    reference: string;
    note: string;
    created_at: string;
    created_by_email: string | null;
    order_id: string | null;
    locations: { name: string } | null;
    product_variants: { product_id: string; colors: { name: string; display_name: string | null } | null; sizes: { name: string } | null } | null;
}

const PAGE_SIZE = 50;

const variantOf = (m: Movement) =>
    [m.product_variants?.colors?.display_name || m.product_variants?.colors?.name, m.product_variants?.sizes?.name].filter(Boolean).join(" / ");

export default function MovementsPage() {
    const { t } = useAdminT();
    const [movements, setMovements] = useState<Movement[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [type, setType] = useState<MovementType | undefined>();
    const [locationId, setLocationId] = useState<string | undefined>();
    const [search, setSearch] = useState("");
    const [locations, setLocations] = useState<NamedRow[]>([]);

    const query = useCallback(
        (offset: number, limit: number) => {
            const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
            if (type) params.set("type", type);
            if (locationId) params.set("location_id", locationId);
            if (search.trim()) params.set("search", search.trim());
            return `/api/stock/movements?${params}`;
        },
        [type, locationId, search]
    );

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(query((page - 1) * PAGE_SIZE, PAGE_SIZE));
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            setMovements(json.data);
            setTotal(json.total);
        } catch (e) {
            message.error(t((e as Error).message));
        } finally {
            setLoading(false);
        }
    }, [query, page]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        apiJson<NamedRow[]>("/api/stock/locations").then(setLocations).catch(() => undefined);
    }, []);

    const exportCsv = async () => {
        try {
            const res = await fetch(query(0, 500));
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            downloadCsv(
                `stock-movements-${dayjs().format("YYYY-MM-DD")}.csv`,
                ["Date", "Type", "Product", "Variant", "SKU", "Location", "Quantity", "Reference", "Note", "By"],
                (json.data as Movement[]).map((m) => [
                    dayjs(m.created_at).format("YYYY-MM-DD HH:mm"), t(MOVEMENT_LABELS[m.type]), m.product_name, variantOf(m), m.sku,
                    m.locations?.name, m.quantity, m.reference, m.note, m.created_by_email,
                ])
            );
            if (json.total > 500) message.info(t("Exported the latest 500 movements. Narrow the filters to export older ones."));
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const columns: ColumnsType<Movement> = [
        { title: t("Date"), dataIndex: "created_at", width: 150, render: (d) => dayjs(d).format("DD MMM YYYY HH:mm") },
        { title: t("Type"), dataIndex: "type", render: (type: MovementType) => <Tag color={MOVEMENT_COLORS[type]}>{t(MOVEMENT_LABELS[type])}</Tag> },
        {
            title: t("Product"),
            key: "product",
            render: (_, m) => (
                <div>
                    {m.product_variants ? <Link href={`/admin/products/${m.product_variants.product_id}/edit`}>{m.product_name}</Link> : m.product_name}
                    <div><Text type="secondary" style={{ fontSize: 12 }}>{[variantOf(m), m.sku].filter(Boolean).join(" · ")}</Text></div>
                </div>
            ),
        },
        { title: t("Location"), key: "location", render: (_, m) => m.locations?.name },
        {
            title: t("Qty"),
            dataIndex: "quantity",
            align: "right",
            render: (q: number) => <strong style={{ color: q > 0 ? "#389e0d" : "#cf1322" }}>{q > 0 ? `+${q}` : q}</strong>,
        },
        {
            title: t("Reference"),
            key: "reference",
            render: (_, m) => (
                <div>
                    {m.order_id ? <Link href={`/admin/orders/${m.order_id}`}>{m.reference}</Link> : m.reference}
                    {m.note && <div><Text type="secondary" style={{ fontSize: 12 }}>{m.note}</Text></div>}
                </div>
            ),
        },
        { title: t("By"), dataIndex: "created_by_email", render: (e: string | null) => <Text type="secondary">{e ?? "System"}</Text> },
    ];

    return (
        <Space orientation="vertical" size="large" style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>{t("Stock movements")}</Title>
                    <Text type="secondary">Every change to stock, newest first. Movements can&apos;t be edited; record a correction instead.</Text>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>{t("Refresh")}</Button>
                    <Button icon={<DownloadOutlined />} onClick={exportCsv}>{t("Export CSV")}</Button>
                </Space>
            </div>
            <Card>
                <Space wrap style={{ marginBottom: 16 }}>
                    <Input.Search
                        allowClear
                        placeholder={t("Search product, SKU or reference")}
                        style={{ width: 300 }}
                        onSearch={(value) => { setSearch(value); setPage(1); }}
                    />
                    <Select
                        allowClear
                        placeholder={t("Type")}
                        style={{ width: 160 }}
                        value={type}
                        onChange={(value) => { setType(value); setPage(1); }}
                        options={MOVEMENT_TYPES.map((type) => ({ value: type, label: t(MOVEMENT_LABELS[type]) }))}
                    />
                    <Select
                        allowClear
                        placeholder={t("Location")}
                        style={{ width: 200 }}
                        value={locationId}
                        onChange={(value) => { setLocationId(value); setPage(1); }}
                        options={locations.map((l) => ({ value: l.id, label: l.name }))}
                    />
                </Space>
                <Table
                    rowKey="id"
                    loading={loading}
                    columns={columns}
                    dataSource={movements}
                    scroll={{ x: "max-content" }}
                    pagination={{ current: page, pageSize: PAGE_SIZE, total, showSizeChanger: false, onChange: setPage, showTotal: (count) => t("{count} movements", { count }) }}
                />
            </Card>
        </Space>
    );
}
