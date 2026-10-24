"use client";

import { useState } from "react";
import { Button, Card, Drawer, Table, Tag, Typography } from "antd";
import { useAdminT } from "@/lib/admin-i18n";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/erp/constants";
import { PageHeader } from "@/components/admin/erp/ui";
import { formatDate, formatMoney, useApi } from "@/components/admin/erp/erp-client";

const { Text } = Typography;

interface Session {
    id: string;
    number: string;
    status: string;
    opened_at: string;
    opened_by_email: string | null;
    closed_at: string | null;
    closed_by_email: string | null;
    opening_float: number;
    expected_cash: number | null;
    counted_cash: number | null;
    difference: number | null;
    notes: string | null;
    location: { name: string } | null;
}

interface Summary {
    sales: { id: string; order_number: string; total: number; created_at: string; customer_first_name: string }[];
    movements: { id: string; direction: string; amount: number; label: string; created_at: string }[];
    totals: { sales: number; count: number; discounts: number; by_method: Record<string, number>; expected_cash: number };
}

/** Admin → Till sessions: each opening and closing of the till, with sales and cash differences. */
export default function PosSessionsPage() {
    const { t, locale } = useAdminT();
    const { data, loading } = useApi<Session[]>("/api/pos?sessions=1");
    const [selected, setSelected] = useState<Session | null>(null);
    const detail = useApi<Summary>(selected ? `/api/pos?session_id=${selected.id}` : null);
    const money = (n: number | null) => (n === null ? "—" : formatMoney(n, locale));

    return (
        <div>
            <PageHeader title={t("Till sessions")} subtitle={t("Every opening and closing of the till, and any cash difference.")} crumbs={[{ title: t("Point of sale"), href: "/admin/pos" }]} />
            <Card>
                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={data ?? []}
                    scroll={{ x: "max-content" }}
                    columns={[
                        { title: t("Session"), dataIndex: "number", render: (v: string, r) => <Button type="link" onClick={() => setSelected(r)} style={{ padding: 0 }}>{v}</Button> },
                        { title: t("Shop"), key: "loc", render: (_, r) => r.location?.name ?? "—" },
                        { title: t("Opened"), dataIndex: "opened_at", render: (v: string, r) => <span>{formatDate(v, locale, true)}<br /><Text type="secondary" style={{ fontSize: 12 }}>{r.opened_by_email}</Text></span> },
                        { title: t("Closed"), dataIndex: "closed_at", render: (v: string | null, r) => (v ? <span>{formatDate(v, locale, true)}<br /><Text type="secondary" style={{ fontSize: 12 }}>{r.closed_by_email}</Text></span> : <Tag color="green">{t("Open")}</Tag>) },
                        { title: t("Starting cash"), dataIndex: "opening_float", render: money },
                        { title: t("Cash expected"), dataIndex: "expected_cash", render: money },
                        { title: t("Cash counted"), dataIndex: "counted_cash", render: money },
                        { title: t("Difference"), dataIndex: "difference", render: (v: number | null) => (v === null ? "—" : <Tag color={Math.abs(v) < 0.0005 ? "green" : "red"}>{money(v)}</Tag>) },
                    ]}
                />
            </Card>
            <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.number} size={520}>
                {detail.data && (
                    <>
                        <p>{t("{count} sale(s) · {amount}", { count: detail.data.totals.count, amount: money(detail.data.totals.sales) })}</p>
                        {Object.entries(detail.data.totals.by_method).map(([m, amount]) => <p key={m}>{t(PAYMENT_METHOD_LABELS[m as PaymentMethod] ?? m)}: <b>{money(amount)}</b></p>)}
                        {detail.data.totals.discounts > 0 && <p>{t("Discounts given")}: {money(detail.data.totals.discounts)}</p>}
                        <Table size="small" rowKey="id" pagination={false} dataSource={detail.data.movements} locale={{ emptyText: t("No cash in or out.") }}
                            columns={[
                                { title: t("Cash in/out"), dataIndex: "label" },
                                { title: t("Amount"), key: "a", render: (_, m) => <span style={{ color: m.direction === "out" ? "#cf1322" : undefined }}>{m.direction === "out" ? "−" : "+"}{money(m.amount)}</span> },
                            ]} />
                        <Table size="small" rowKey="id" style={{ marginTop: 12 }} pagination={{ pageSize: 15 }} dataSource={detail.data.sales}
                            columns={[
                                { title: t("Sale"), dataIndex: "order_number", render: (v: string, r) => <a href={`/admin/pos/receipt/${r.id}`} target="_blank" rel="noreferrer">{v}</a> },
                                { title: t("Time"), dataIndex: "created_at", render: (v: string) => formatDate(v, locale, true) },
                                { title: t("Total"), dataIndex: "total", render: money },
                            ]} />
                    </>
                )}
            </Drawer>
        </div>
    );
}
