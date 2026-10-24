"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Progress, Select, Space, Table, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useAdminT } from "@/lib/admin-i18n";
import { PO_STATUSES, PO_STATUS_COLORS, PO_STATUS_LABELS, type PurchaseOrderStatus } from "@/lib/erp/constants";
import { PageHeader } from "@/components/admin/erp/ui";
import { formatDate, formatMoney, useApi } from "@/components/admin/erp/erp-client";

interface PurchaseOrder {
    id: string;
    number: string;
    status: PurchaseOrderStatus;
    order_date: string;
    expected_date: string | null;
    total: number;
    supplier: { name: string } | null;
    line_count: number;
    ordered_quantity: number;
    received_quantity: number;
}

/**
 * Admin → Purchase orders. Price requests to suppliers, orders, and what has arrived. Goods enter
 * stock when their receipt is checked and validated on the purchase order.
 */
export default function PurchaseOrdersPage() {
    const { t, locale } = useAdminT();
    const [status, setStatus] = useState("");
    const { data, loading } = useApi<PurchaseOrder[]>(`/api/purchasing/orders${status ? `?status=${status}` : ""}`);

    return (
        <div>
            <PageHeader
                title={t("Purchase orders")}
                subtitle={t("Price requests, orders to suppliers, and goods received.")}
                extra={<Link href="/admin/purchasing/new"><Button type="primary" icon={<PlusOutlined />}>{t("New purchase order")}</Button></Link>}
            />
            <Card>
                <Space style={{ marginBottom: 16 }} wrap>
                    <Select value={status} onChange={setStatus} style={{ width: 200 }} options={[{ value: "", label: t("All statuses") }, ...PO_STATUSES.map((s) => ({ value: s, label: t(PO_STATUS_LABELS[s]) }))]} />
                    <Link href="/admin/purchasing/prices">{t("Compare supplier prices")}</Link>
                </Space>
                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={data ?? []}
                    scroll={{ x: "max-content" }}
                    columns={[
                        { title: t("Number"), dataIndex: "number", render: (v: string, r) => <Link href={`/admin/purchasing/${r.id}`} style={{ fontFamily: "monospace" }}>{v}</Link> },
                        { title: t("Supplier"), key: "supplier", render: (_, r) => r.supplier?.name ?? "—" },
                        { title: t("Status"), dataIndex: "status", render: (v: PurchaseOrderStatus) => <Tag color={PO_STATUS_COLORS[v]}>{t(PO_STATUS_LABELS[v])}</Tag> },
                        { title: t("Date"), dataIndex: "order_date", render: (v: string) => formatDate(v, locale) },
                        { title: t("Expected"), dataIndex: "expected_date", render: (v: string | null, r) => (v ? <span style={{ color: r.status === "ordered" && v < new Date().toISOString().slice(0, 10) ? "#cf1322" : undefined }}>{formatDate(v, locale)}</span> : "—") },
                        { title: t("Received"), key: "received", render: (_, r) => <Progress percent={r.ordered_quantity ? Math.round((r.received_quantity / r.ordered_quantity) * 100) : 0} size="small" style={{ minWidth: 120 }} /> },
                        { title: t("Total"), dataIndex: "total", align: "right", render: (v: number) => formatMoney(v, locale) },
                    ]}
                />
            </Card>
        </div>
    );
}
