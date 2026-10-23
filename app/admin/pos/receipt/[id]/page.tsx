"use client";

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button, Spin } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { useAdminT } from "@/lib/admin-i18n";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/erp/constants";
import { formatDate, formatMoney, useApi } from "@/components/admin/erp/erp-client";

interface Receipt {
    order_number: string;
    created_at: string;
    subtotal: number;
    discount_amount: number;
    total: number;
    customer_first_name: string;
    customer_last_name: string;
    created_by_email: string | null;
    pos_session: { number: string; location: { name: string } | null } | null;
    items: { product_name: string; variant_label: string | null; quantity: number; price: number; subtotal: number }[];
    payments: { amount: number; method: PaymentMethod }[];
    company: { name?: string; address?: string; phone?: string; tax_id?: string };
}

/** A till receipt sized for 80 mm printers (?print=1 opens the print dialog). */
export default function ReceiptPage() {
    const { t, locale } = useAdminT();
    const { id } = useParams<{ id: string }>();
    const search = useSearchParams();
    const { data } = useApi<Receipt>(`/api/pos?receipt=${id}`);
    const money = (n: number) => formatMoney(n, locale);

    useEffect(() => {
        if (data && search.get("print") === "1") setTimeout(() => window.print(), 300);
    }, [data, search]);

    if (!data) return <Spin />;
    return (
        <div>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .receipt, .receipt * { visibility: visible; }
                    .receipt { position: absolute; inset: 0 auto auto 0; width: 76mm; }
                    .no-print { display: none !important; }
                    @page { size: 80mm auto; margin: 2mm; }
                }
            `}</style>
            <Button className="no-print" icon={<PrinterOutlined />} onClick={() => window.print()} style={{ marginBottom: 16 }}>{t("Print receipt")}</Button>
            <div className="receipt" style={{ width: 300, background: "#fff", padding: 12, fontFamily: "monospace", fontSize: 12, color: "#000", border: "1px dashed #ccc" }}>
                <div style={{ textAlign: "center", fontWeight: 700, fontSize: 15 }}>{data.company.name || "Kachabity"}</div>
                {data.company.address && <div style={{ textAlign: "center" }}>{data.company.address}</div>}
                {data.company.phone && <div style={{ textAlign: "center" }}>{data.company.phone}</div>}
                {data.company.tax_id && <div style={{ textAlign: "center" }}>{t("Tax ID")}: {data.company.tax_id}</div>}
                <hr />
                <div>{t("Receipt")} {data.order_number}</div>
                <div>{formatDate(data.created_at, locale, true)}</div>
                {data.pos_session && <div>{data.pos_session.location?.name} · {data.pos_session.number}</div>}
                {data.created_by_email && <div>{t("Cashier")}: {data.created_by_email}</div>}
                <hr />
                {data.items.map((item, i) => (
                    <div key={i} style={{ marginBottom: 4 }}>
                        <div>{item.product_name}{item.variant_label ? ` (${item.variant_label})` : ""}</div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>{item.quantity} × {money(item.price)}</span>
                            <span>{money(item.subtotal)}</span>
                        </div>
                    </div>
                ))}
                <hr />
                {Number(data.discount_amount) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("Discount")}</span><span>− {money(data.discount_amount)}</span></div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}><span>{t("Total")}</span><span>{money(data.total)}</span></div>
                {data.payments.map((p, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between" }}><span>{t(PAYMENT_METHOD_LABELS[p.method] ?? p.method)}</span><span>{money(p.amount)}</span></div>
                ))}
                <hr />
                <div style={{ textAlign: "center" }}>{t("Thank you for your visit!")}</div>
                <div style={{ textAlign: "center", fontSize: 10 }}>{t("Prices include VAT.")}</div>
            </div>
        </div>
    );
}
