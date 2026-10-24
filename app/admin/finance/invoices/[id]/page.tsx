"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Button, Input, Modal, Space, Spin, Tag } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { message } from "@/components/admin/antd-app";
import { useAdminT } from "@/lib/admin-i18n";
import { api, formatDate, useApi } from "@/components/admin/erp/erp-client";

interface Invoice {
    id: string;
    number: string;
    kind: "invoice" | "credit_note";
    credit_note_for: string | null;
    order_id: string | null;
    invoice_date: string;
    customer_name: string;
    customer_phone: string | null;
    customer_address: string | null;
    customer_tax_id: string | null;
    lines: { description: string; quantity: number; unit_price_ht: number; total_ht: number }[];
    amount_ht: number;
    vat_rate: number;
    vat_amount: number;
    stamp: number;
    total: number;
    status: string;
    notes: string | null;
    order: { order_number: string } | null;
    company: { name?: string; tax_id?: string; address?: string; phone?: string; email?: string; rc?: string };
}

const fmt = (n: number) => Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/**
 * A sales invoice or credit note, laid out for printing (A4, in French as Tunisian invoices
 * usually are). Cancelling creates a credit note; issued invoices never change.
 */
export default function InvoicePage() {
    const { t } = useAdminT();
    const { id } = useParams<{ id: string }>();
    const { data, reload } = useApi<Invoice>(`/api/finance/invoices?id=${id}`);
    const [cancelling, setCancelling] = useState(false);
    const [reason, setReason] = useState("");

    const cancel = async () => {
        try {
            const credit = await api<{ id: string; number: string }>("/api/finance/invoices", { method: "PATCH", body: { id, reason } });
            message.success(t("Credit note {number} issued", { number: credit.number }));
            setCancelling(false);
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    if (!data) return <Spin />;
    const c = data.company ?? {};
    const credit = data.kind === "credit_note";

    return (
        <div>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .invoice, .invoice * { visibility: visible; }
                    .invoice { position: absolute; inset: 0 auto auto 0; width: 100%; box-shadow: none !important; }
                    .no-print { display: none !important; }
                    @page { size: A4; margin: 14mm; }
                }
                .invoice table { width: 100%; border-collapse: collapse; }
                .invoice th, .invoice td { border-bottom: 1px solid #e5e5e5; padding: 6px 8px; text-align: start; }
                .invoice td.n, .invoice th.n { text-align: end; font-variant-numeric: tabular-nums; }
            `}</style>
            <Space className="no-print" style={{ marginBottom: 16 }} wrap>
                <Link href="/admin/finance/invoices"><Button>{t("Invoices")}</Button></Link>
                <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>{t("Print")}</Button>
                {data.kind === "invoice" && data.status === "issued" && <Button danger onClick={() => setCancelling(true)}>{t("Cancel with a credit note")}</Button>}
                {data.order_id && <Link href={`/admin/orders/${data.order_id}`}><Button>{t("Order")}</Button></Link>}
                {data.status === "cancelled" && <Tag color="red">{t("Cancelled")}</Tag>}
            </Space>
            {!c.tax_id && <Alert className="no-print" type="warning" showIcon style={{ marginBottom: 16 }} title={t("Add the company's tax ID and address in Accounting → Settings so they print on invoices.")} />}

            <div className="invoice" dir="ltr" lang="fr" style={{ background: "#fff", padding: 32, maxWidth: 820, boxShadow: "0 1px 6px rgba(0,0,0,0.08)", color: "#111", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{c.name || "Kachabity"}</div>
                        {c.address && <div>{c.address}</div>}
                        {c.phone && <div>Tél. : {c.phone}</div>}
                        {c.email && <div>{c.email}</div>}
                        {c.tax_id && <div>Matricule fiscal : {c.tax_id}</div>}
                        {c.rc && <div>RC : {c.rc}</div>}
                    </div>
                    <div style={{ textAlign: "end" }}>
                        <div style={{ fontSize: 22, fontWeight: 700 }}>{credit ? "AVOIR" : "FACTURE"}</div>
                        <div>N° {data.number}</div>
                        <div>Date : {formatDate(data.invoice_date, "fr")}</div>
                        {data.order && <div>Commande : {data.order.order_number}</div>}
                    </div>
                </div>
                <div style={{ marginTop: 24, padding: 12, background: "#fafafa", borderRadius: 6 }}>
                    <div style={{ fontWeight: 600 }}>Client</div>
                    <div>{data.customer_name}</div>
                    {data.customer_address && <div>{data.customer_address}</div>}
                    {data.customer_phone && <div>Tél. : {data.customer_phone}</div>}
                    {data.customer_tax_id && <div>Matricule fiscal : {data.customer_tax_id}</div>}
                </div>
                <table style={{ marginTop: 24 }}>
                    <thead>
                        <tr style={{ background: "#f5f5f5" }}>
                            <th>Désignation</th>
                            <th className="n">Qté</th>
                            <th className="n">P.U. HT</th>
                            <th className="n">Total HT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.lines.map((l, i) => (
                            <tr key={i}>
                                <td>{l.description}</td>
                                <td className="n">{l.quantity}</td>
                                <td className="n">{fmt(l.unit_price_ht)}</td>
                                <td className="n">{fmt(l.total_ht)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                    <table style={{ width: 300 }}>
                        <tbody>
                            <tr><td>Total HT</td><td className="n">{fmt(data.amount_ht)}</td></tr>
                            <tr><td>TVA {Number(data.vat_rate)}%</td><td className="n">{fmt(data.vat_amount)}</td></tr>
                            {Number(data.stamp) !== 0 && <tr><td>Droit de timbre</td><td className="n">{fmt(data.stamp)}</td></tr>}
                            <tr style={{ fontWeight: 700, fontSize: 15 }}><td>Total TTC</td><td className="n">{fmt(data.total)} TND</td></tr>
                        </tbody>
                    </table>
                </div>
                {data.notes && <div style={{ marginTop: 16 }}>Motif : {data.notes}</div>}
                <div style={{ marginTop: 40, fontSize: 11, color: "#666" }}>
                    {credit ? "Cet avoir annule la facture correspondante." : "Merci pour votre confiance."}
                </div>
            </div>

            <Modal open={cancelling} title={t("Cancel invoice {number}", { number: data.number })} onCancel={() => setCancelling(false)} onOk={cancel} okText={t("Issue credit note")} okButtonProps={{ danger: true }} cancelText={t("Back")}>
                <p>{t("A credit note for the same amounts is issued. The invoice keeps its number.")}</p>
                <Input.TextArea rows={2} placeholder={t("Reason")} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Modal>
        </div>
    );
}
