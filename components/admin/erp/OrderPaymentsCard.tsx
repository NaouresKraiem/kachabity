"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from "antd";
import { DeleteOutlined, FileDoneOutlined, PlusOutlined, PrinterOutlined } from "@ant-design/icons";
import { message } from "@/components/admin/antd-app";
import { useAdminT } from "@/lib/admin-i18n";
import { useAdminRole } from "@/lib/admin-role-context";
import { MONEY_ACCOUNT_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type MoneyAccount, type PaymentMethod } from "@/lib/erp/constants";
import { PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from "@/components/admin/order-status";
import { api, formatDate, formatMoney, useApi } from "./erp-client";

const { Text } = Typography;

interface Payment {
    id: string;
    amount: number;
    method: PaymentMethod;
    account: MoneyAccount;
    received_at: string;
    reference: string | null;
    remittance_id: string | null;
    created_by_email: string | null;
}

interface Invoice {
    id: string;
    number: string;
    kind: string;
    status: string;
    total: number;
}

/**
 * Money received for one order: each payment (cash, card, transfer, cash on delivery...), what is
 * still owed, refunds, and the invoice. Recording money needs the finance permission.
 */
export default function OrderPaymentsCard({ order, onChanged }: {
    order: { id: string; total: number; paid_amount: number; payment_status: string; status: string };
    onChanged: () => void;
}) {
    const { t, locale } = useAdminT();
    const { can } = useAdminRole();
    const finance = can("finance");
    const payments = useApi<Payment[]>(`/api/sales/payments?order_id=${order.id}`);
    const invoices = useApi<Invoice[]>(finance ? `/api/finance/invoices?order_id=${order.id}` : null);
    const [open, setOpen] = useState<"pay" | "refund" | null>(null);
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);
    const owed = Math.max(0, Number(order.total) - Number(order.paid_amount));
    const money = (n: number) => formatMoney(n, locale);

    const reload = () => {
        payments.reload();
        invoices.reload();
        onChanged();
    };

    const save = async () => {
        const values = await form.validateFields();
        setSaving(true);
        try {
            await api("/api/sales/payments", {
                method: "POST",
                body: { order_id: order.id, amount: open === "refund" ? -Math.abs(values.amount) : values.amount, method: values.method, account: values.account, reference: values.reference || undefined },
            });
            message.success(t(open === "refund" ? "Refund recorded" : "Payment recorded"));
            setOpen(null);
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id: string) => {
        try {
            await api(`/api/sales/payments?id=${id}`, { method: "DELETE" });
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const issueInvoice = async () => {
        try {
            const invoice = await api<Invoice>("/api/finance/invoices", { method: "POST", body: { order_id: order.id } });
            message.success(t("Invoice {number} issued", { number: invoice.number }));
            invoices.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const liveInvoice = invoices.data?.find((i) => i.kind === "invoice" && i.status === "issued");

    return (
        <Card
            title={<span>{t("Payments")} <Tag color={PAYMENT_STATUS_COLORS[order.payment_status]}>{t(PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status)}</Tag></span>}
            extra={finance && (
                <Space wrap>
                    {owed > 0 && <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ amount: owed, method: "cash", account: "cash", reference: "" }); setOpen("pay"); }}>{t("Record payment")}</Button>}
                    {Number(order.paid_amount) > 0 && <Button onClick={() => { form.resetFields(); form.setFieldsValue({ amount: Number(order.paid_amount), method: "cash", account: "cash", reference: "" }); setOpen("refund"); }}>{t("Refund")}</Button>}
                </Space>
            )}
        >
            <Space size="large" wrap style={{ marginBottom: 12 }}>
                <span>{t("Total")}: <b>{money(order.total)}</b></span>
                <span>{t("Received")}: <b>{money(order.paid_amount)}</b></span>
                <span>{t("Still owed")}: <b style={{ color: owed > 0 ? "#d48806" : undefined }}>{money(owed)}</b></span>
            </Space>
            {order.status === "delivered" && owed > 0 && (
                <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t("Delivered but not paid yet. Cash on delivery is recorded when Colissimo reports it paid, or record it here.")} />
            )}
            <Table
                size="small"
                rowKey="id"
                loading={payments.loading}
                dataSource={payments.data ?? []}
                pagination={false}
                locale={{ emptyText: t("No payment received yet.") }}
                scroll={{ x: "max-content" }}
                columns={[
                    { title: t("Date"), dataIndex: "received_at", render: (v: string) => formatDate(v, locale, true) },
                    { title: t("Amount"), dataIndex: "amount", render: (v: number) => <span style={{ color: v < 0 ? "#cf1322" : undefined }}>{money(v)}</span> },
                    { title: t("Method"), dataIndex: "method", render: (v: PaymentMethod) => t(PAYMENT_METHOD_LABELS[v] ?? v) },
                    { title: t("Where"), dataIndex: "account", render: (v: MoneyAccount, r) => <span>{t(MONEY_ACCOUNT_LABELS[v] ?? v)}{v === "carrier" && <Tag style={{ marginInlineStart: 6 }} color={r.remittance_id ? "green" : "orange"}>{r.remittance_id ? t("Paid out") : t("Not paid out yet")}</Tag>}</span> },
                    { title: t("Reference"), dataIndex: "reference", render: (v: string | null) => v ?? "—" },
                    { title: t("By"), dataIndex: "created_by_email", render: (v: string | null) => v ?? t("Automatic") },
                    ...(finance ? [{
                        title: "", key: "x", render: (_: unknown, r: Payment) => !r.remittance_id && (
                            <Popconfirm title={t("Remove this payment?")} description={t("Its accounting entry is reversed.")} onConfirm={() => remove(r.id)}>
                                <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={t("Remove")} />
                            </Popconfirm>
                        ),
                    }] : []),
                ]}
            />
            {finance && (
                <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <FileDoneOutlined />
                    {liveInvoice ? (
                        <>
                            <Text>{t("Invoice {number}", { number: liveInvoice.number })}</Text>
                            <Link href={`/admin/finance/invoices/${liveInvoice.id}`}><Button size="small" icon={<PrinterOutlined />}>{t("Open / print")}</Button></Link>
                        </>
                    ) : ["cancelled", "returned"].includes(order.status) ? (
                        <Text type="secondary">{t("Cancelled and returned orders are not invoiced.")}</Text>
                    ) : (
                        <Popconfirm title={t("Issue the invoice?")} description={t("Invoices are numbered in sequence and can only be cancelled with a credit note.")} onConfirm={issueInvoice}>
                            <Button size="small">{t("Issue invoice")}</Button>
                        </Popconfirm>
                    )}
                </div>
            )}

            <Modal open={open !== null} title={open === "refund" ? t("Record a refund") : t("Record a payment")} onCancel={() => setOpen(null)} onOk={save} confirmLoading={saving} okText={t("Save")} cancelText={t("Cancel")} forceRender>
                <Form form={form} layout="vertical">
                    <Form.Item name="amount" label={t("Amount")} rules={[{ required: true }]}>
                        <InputNumber min={0.001} precision={3} style={{ width: "100%" }} suffix="TND" />
                    </Form.Item>
                    <Form.Item name="method" label={t("Method")} rules={[{ required: true }]}>
                        <Select
                            options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(PAYMENT_METHOD_LABELS[m]) }))}
                            onChange={(m: string) => form.setFieldValue("account", m === "cash" ? "cash" : m === "cod" ? "carrier" : "bank")}
                        />
                    </Form.Item>
                    <Form.Item name="account" label={t("Where is the money now?")} rules={[{ required: true }]}>
                        <Select options={(Object.keys(MONEY_ACCOUNT_LABELS) as MoneyAccount[]).map((a) => ({ value: a, label: t(MONEY_ACCOUNT_LABELS[a]) }))} />
                    </Form.Item>
                    <Form.Item name="reference" label={t("Reference")}>
                        <Input placeholder={t("Receipt, transfer or cheque number")} />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
}
