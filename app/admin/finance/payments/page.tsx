"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { Alert, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Table, Tabs, Tag, Typography } from "antd";
import { BankOutlined } from "@ant-design/icons";
import { message } from "@/components/admin/antd-app";
import { useAdminT } from "@/lib/admin-i18n";
import { MONEY_ACCOUNTS, MONEY_ACCOUNT_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type MoneyAccount, type PaymentMethod } from "@/lib/erp/constants";
import { Kpi, PageHeader, PeriodFilter, usePeriod } from "@/components/admin/erp/ui";
import { api, day, formatDate, formatMoney, useApi } from "@/components/admin/erp/erp-client";

const { Text } = Typography;

interface Payment {
    id: string;
    order_id: string;
    amount: number;
    method: PaymentMethod;
    account: MoneyAccount;
    received_at: string;
    reference: string | null;
    remittance_id: string | null;
    created_by_email: string | null;
    order: { order_number: string; customer_first_name: string; customer_last_name: string; total: number } | null;
}

interface Remittances {
    remittances: { id: string; provider: string; reference: string | null; received_on: string; gross_amount: number; fees: number; net_amount: number; account: string; payments: { id: string }[] }[];
    open_payments: { id: string; amount: number; received_at: string; reference: string | null; order_id: string; order: { order_number: string; customer_first_name: string; customer_last_name: string; delivered_at: string | null } | null }[];
}

/**
 * Admin → Payments received. Every payment recorded against an order (till, bank, cash on
 * delivery), and the delivery company's payouts: cash collected on delivered parcels stays "held by
 * the delivery company" until its transfer arrives; recording the payout (with its fees) clears it.
 */
export default function PaymentsPage() {
    const { t, locale } = useAdminT();
    const { value: periodValue, setValue: setPeriod, from, to } = usePeriod("30d");
    const [account, setAccount] = useState("");
    const [method, setMethod] = useState("");
    const list = useApi<Payment[]>(`/api/sales/payments?from=${from.toISOString()}&to=${to.toISOString()}${account ? `&account=${account}` : ""}${method ? `&method=${method}` : ""}`);
    const payouts = useApi<Remittances>("/api/sales/remittances");
    const [selected, setSelected] = useState<string[]>([]);
    const [payoutOpen, setPayoutOpen] = useState(false);
    const [form] = Form.useForm();
    const money = (n: number) => formatMoney(n, locale);

    const totals = useMemo(() => {
        const byAccount: Record<string, number> = {};
        for (const p of list.data ?? []) byAccount[p.account] = (byAccount[p.account] ?? 0) + Number(p.amount);
        return byAccount;
    }, [list.data]);
    const openTotal = (payouts.data?.open_payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const selectedTotal = (payouts.data?.open_payments ?? []).filter((p) => selected.includes(p.id)).reduce((s, p) => s + Number(p.amount), 0);

    const recordPayout = async () => {
        const values = await form.validateFields();
        try {
            await api("/api/sales/remittances", {
                method: "POST",
                body: { payment_ids: selected, gross_amount: selectedTotal, fees: values.fees ?? 0, received_on: day(values.received_on), account: values.account, reference: values.reference || undefined },
            });
            message.success(t("Payout recorded"));
            setPayoutOpen(false);
            setSelected([]);
            payouts.reload();
            list.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const cancelPayout = async (id: string) => {
        try {
            await api(`/api/sales/remittances?id=${id}`, { method: "DELETE" });
            payouts.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    return (
        <div>
            <PageHeader title={t("Payments received")} subtitle={t("Money that really came in for orders, and the delivery company's payouts.")} />
            <Tabs
                items={[
                    {
                        key: "payments",
                        label: t("Payments"),
                        children: (
                            <>
                                <Card style={{ marginBottom: 16 }} styles={{ body: { display: "flex", gap: 8, flexWrap: "wrap" } }}>
                                    <PeriodFilter value={periodValue} onChange={setPeriod} />
                                    <Select value={account} onChange={setAccount} style={{ width: 220 }} options={[{ value: "", label: t("Everywhere") }, ...MONEY_ACCOUNTS.map((a) => ({ value: a, label: t(MONEY_ACCOUNT_LABELS[a]) }))]} />
                                    <Select value={method} onChange={setMethod} style={{ width: 180 }} options={[{ value: "", label: t("All methods") }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: t(PAYMENT_METHOD_LABELS[m]) }))]} />
                                </Card>
                                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                                    {MONEY_ACCOUNTS.map((a) => (
                                        <Col xs={24} md={8} key={a}><Kpi title={t(MONEY_ACCOUNT_LABELS[a])} value={money(totals[a] ?? 0)} loading={list.loading} /></Col>
                                    ))}
                                </Row>
                                <Card>
                                    <Table
                                        rowKey="id"
                                        loading={list.loading}
                                        dataSource={list.data ?? []}
                                        scroll={{ x: "max-content" }}
                                        columns={[
                                            { title: t("Date"), dataIndex: "received_at", render: (v: string) => formatDate(v, locale, true) },
                                            { title: t("Order"), key: "o", render: (_, r) => <Link href={`/admin/orders/${r.order_id}`}>{r.order?.order_number} · {r.order?.customer_first_name} {r.order?.customer_last_name}</Link> },
                                            { title: t("Amount"), dataIndex: "amount", align: "right", render: (v: number) => <span style={{ color: v < 0 ? "#cf1322" : undefined }}>{money(v)}</span> },
                                            { title: t("Method"), dataIndex: "method", render: (v: PaymentMethod) => t(PAYMENT_METHOD_LABELS[v] ?? v) },
                                            { title: t("Where"), dataIndex: "account", render: (v: MoneyAccount, r) => <span>{t(MONEY_ACCOUNT_LABELS[v])}{v === "carrier" && <Tag style={{ marginInlineStart: 6 }} color={r.remittance_id ? "green" : "orange"}>{r.remittance_id ? t("Paid out") : t("Not paid out yet")}</Tag>}</span> },
                                            { title: t("Reference"), dataIndex: "reference", render: (v: string | null) => v ?? "—" },
                                            { title: t("By"), dataIndex: "created_by_email", render: (v: string | null) => v ?? t("Automatic") },
                                        ]}
                                    />
                                </Card>
                            </>
                        ),
                    },
                    {
                        key: "payouts",
                        label: t("Delivery company payouts"),
                        children: (
                            <>
                                <Alert
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                    title={t("Colissimo holds {amount} for delivered parcels.", { amount: money(openTotal) })}
                                    description={t("When their transfer arrives, tick the parcels it covers (match their statement), enter their fees, and record the payout. The bank receives the amount minus the fees.")}
                                />
                                <Card
                                    title={t("Not paid out yet")}
                                    extra={<Button type="primary" icon={<BankOutlined />} disabled={!selected.length} onClick={() => { form.resetFields(); form.setFieldsValue({ received_on: dayjs(), account: "bank", fees: 0 }); setPayoutOpen(true); }}>{t("Record payout ({amount})", { amount: money(selectedTotal) })}</Button>}
                                >
                                    <Table
                                        rowKey="id"
                                        size="small"
                                        loading={payouts.loading}
                                        dataSource={payouts.data?.open_payments ?? []}
                                        rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as string[]) }}
                                        pagination={{ pageSize: 50 }}
                                        scroll={{ x: "max-content" }}
                                        columns={[
                                            { title: t("Order"), key: "o", render: (_, r) => <Link href={`/admin/orders/${r.order_id}`}>{r.order?.order_number} · {r.order?.customer_first_name} {r.order?.customer_last_name}</Link> },
                                            { title: t("Barcode"), dataIndex: "reference", render: (v: string | null) => v ?? "—" },
                                            { title: t("Paid at Colissimo"), dataIndex: "received_at", render: (v: string) => formatDate(v, locale) },
                                            { title: t("Amount"), dataIndex: "amount", align: "right", render: (v: number) => money(v) },
                                        ]}
                                    />
                                </Card>
                                <Card title={t("Payouts received")} style={{ marginTop: 16 }}>
                                    <Table
                                        rowKey="id"
                                        size="small"
                                        loading={payouts.loading}
                                        dataSource={payouts.data?.remittances ?? []}
                                        scroll={{ x: "max-content" }}
                                        columns={[
                                            { title: t("Date"), dataIndex: "received_on", render: (v: string) => formatDate(v, locale) },
                                            { title: t("Reference"), dataIndex: "reference", render: (v: string | null) => v ?? "—" },
                                            { title: t("Parcels"), key: "n", render: (_, r) => r.payments.length },
                                            { title: t("Collected"), dataIndex: "gross_amount", align: "right", render: (v: number) => money(v) },
                                            { title: t("Fees"), dataIndex: "fees", align: "right", render: (v: number) => money(v) },
                                            { title: t("Received"), dataIndex: "net_amount", align: "right", render: (v: number) => <b>{money(v)}</b> },
                                            { title: "", key: "x", render: (_, r) => <Popconfirm title={t("Cancel this payout?")} description={t("Its parcels become owed by Colissimo again.")} onConfirm={() => cancelPayout(r.id)}><Button size="small" danger type="text">{t("Cancel")}</Button></Popconfirm> },
                                        ]}
                                    />
                                </Card>
                            </>
                        ),
                    },
                ]}
            />

            <Modal open={payoutOpen} title={t("Record a payout")} onCancel={() => setPayoutOpen(false)} onOk={recordPayout} okText={t("Save")} cancelText={t("Cancel")} forceRender>
                <p>{t("{count} parcel(s) · {amount} collected", { count: selected.length, amount: money(selectedTotal) })}</p>
                <Form form={form} layout="vertical">
                    <Form.Item name="received_on" label={t("Date received")} rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" /></Form.Item>
                    <Form.Item name="fees" label={t("Delivery fees kept by Colissimo")}><InputNumber min={0} precision={3} style={{ width: "100%" }} suffix="TND" /></Form.Item>
                    <Form.Item name="account" label={t("Received in")}><Select options={[{ value: "bank", label: t("Bank") }, { value: "cash", label: t("Cash register") }]} /></Form.Item>
                    <Form.Item name="reference" label={t("Reference")}><Input placeholder={t("Transfer or statement number")} /></Form.Item>
                    <Form.Item noStyle shouldUpdate>{() => <Text>{t("Net received")}: <b>{money(selectedTotal - (form.getFieldValue("fees") ?? 0))}</b></Text>}</Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
