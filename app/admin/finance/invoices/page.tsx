"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, Input, Segmented, Table, Tag } from "antd";
import { useAdminT } from "@/lib/admin-i18n";
import { PageHeader } from "@/components/admin/erp/ui";
import { formatDate, formatMoney, useApi } from "@/components/admin/erp/erp-client";

interface Invoice {
    id: string;
    number: string;
    kind: "invoice" | "credit_note";
    order_id: string | null;
    invoice_date: string;
    customer_name: string;
    customer_phone: string | null;
    amount_ht: number;
    vat_amount: number;
    stamp: number;
    total: number;
    status: string;
}

/**
 * Admin → Invoices: sales invoices and credit notes, numbered in sequence per year. Issue one from
 * an order's page (Payments card); cancel one with a credit note from the invoice itself.
 */
export default function InvoicesPage() {
    const { t, locale } = useAdminT();
    const [kind, setKind] = useState("");
    const [q, setQ] = useState("");
    const { data, loading } = useApi<Invoice[]>(`/api/finance/invoices?${kind ? `kind=${kind}&` : ""}${q ? `q=${encodeURIComponent(q)}` : ""}`);
    const money = (n: number) => formatMoney(n, locale);

    return (
        <div>
            <PageHeader title={t("Invoices")} subtitle={t("Sales invoices and credit notes. Issue an invoice from the order's page.")} />
            <Card>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    <Segmented value={kind} onChange={setKind} options={[{ value: "", label: t("All") }, { value: "invoice", label: t("Invoices") }, { value: "credit_note", label: t("Credit notes") }]} />
                    <Input.Search allowClear placeholder={t("Number, customer or phone")} onSearch={setQ} style={{ width: 280 }} />
                </div>
                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={data ?? []}
                    scroll={{ x: "max-content" }}
                    columns={[
                        { title: t("Number"), dataIndex: "number", render: (v: string, r) => <Link href={`/admin/finance/invoices/${r.id}`} style={{ fontFamily: "monospace" }}>{v}</Link> },
                        { title: t("Date"), dataIndex: "invoice_date", render: (v: string) => formatDate(v, locale) },
                        { title: t("Customer"), dataIndex: "customer_name" },
                        { title: t("Before VAT"), dataIndex: "amount_ht", align: "right", render: (v: number) => money(v) },
                        { title: t("VAT"), dataIndex: "vat_amount", align: "right", render: (v: number) => money(v) },
                        { title: t("Total"), dataIndex: "total", align: "right", render: (v: number) => <b>{money(v)}</b> },
                        { title: t("Status"), key: "s", render: (_, r) => r.kind === "credit_note" ? <Tag color="purple">{t("Credit note")}</Tag> : <Tag color={r.status === "issued" ? "green" : "red"}>{t(r.status === "issued" ? "Issued" : "Cancelled")}</Tag> },
                        { title: t("Order"), dataIndex: "order_id", render: (v: string | null) => (v ? <Link href={`/admin/orders/${v}`}>{t("Open")}</Link> : "—") },
                    ]}
                />
            </Card>
        </div>
    );
}
