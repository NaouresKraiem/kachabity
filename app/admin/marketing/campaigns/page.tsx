"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tag, Typography } from "antd";
import { DeleteOutlined, DollarOutlined, PlusOutlined } from "@ant-design/icons";
import { message } from "@/components/admin/antd-app";
import { useAdminT } from "@/lib/admin-i18n";
import { AD_PLATFORMS, AD_PLATFORM_LABELS, type AdPlatform } from "@/lib/erp/constants";
import { Kpi, PageHeader } from "@/components/admin/erp/ui";
import { api, day, formatDate, formatMoney, useApi } from "@/components/admin/erp/erp-client";

const { Text } = Typography;

interface Campaign {
    id: string;
    name: string;
    platform: AdPlatform;
    starts_on: string | null;
    ends_on: string | null;
    budget: number | null;
    notes: string | null;
    active: boolean;
    spent: number;
    orders: number;
    delivered: number;
    revenue: number;
    cost_per_delivered: number | null;
}

/**
 * Admin → Campaigns & ad spend. What each campaign cost and what it brought: orders tagged with
 * the campaign, delivered sales, cost per delivered sale and return on ad spend. Spend is booked
 * as an advertising expense.
 */
export default function CampaignsPage() {
    const { t, locale } = useAdminT();
    const { data, loading, reload } = useApi<Campaign[]>("/api/marketing/campaigns");
    const [editing, setEditing] = useState<Campaign | "new" | null>(null);
    const [spending, setSpending] = useState<Campaign | null>(null);
    const [viewing, setViewing] = useState<string | null>(null);
    const detail = useApi<Campaign & { spend: { id: string; spend_date: string; amount: number; account: string; note: string | null }[] }>(viewing ? `/api/marketing/campaigns?id=${viewing}` : null);
    const [form] = Form.useForm();
    const [spendForm] = Form.useForm();
    const money = (n: number) => formatMoney(n, locale, 0);
    const totals = (data ?? []).reduce((s, c) => ({ spent: s.spent + Number(c.spent), delivered: s.delivered + c.delivered, revenue: s.revenue + Number(c.revenue) }), { spent: 0, delivered: 0, revenue: 0 });

    const save = async () => {
        const values = await form.validateFields();
        const body = { ...values, starts_on: values.starts_on ? day(values.starts_on) : null, ends_on: values.ends_on ? day(values.ends_on) : null };
        try {
            await api("/api/marketing/campaigns", { method: editing === "new" ? "POST" : "PUT", body: editing === "new" ? body : { id: (editing as Campaign).id, ...body } });
            setEditing(null);
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const addSpend = async () => {
        const values = await spendForm.validateFields();
        try {
            await api("/api/marketing/campaigns", { method: "POST", body: { kind: "spend", campaign_id: spending!.id, spend_date: day(values.spend_date), amount: values.amount, account: values.account, note: values.note } });
            message.success(t("Spend recorded"));
            setSpending(null);
            reload();
            detail.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const removeSpend = async (id: string) => {
        await api(`/api/marketing/campaigns?spend_id=${id}`, { method: "DELETE" }).catch((e) => message.error(t((e as Error).message)));
        reload();
        detail.reload();
    };

    const remove = async (id: string) => {
        await api(`/api/marketing/campaigns?id=${id}`, { method: "DELETE" }).catch((e) => message.error(t((e as Error).message)));
        reload();
    };

    return (
        <div>
            <PageHeader title={t("Campaigns & ad spend")} subtitle={t("What each ad campaign cost and what it really sold.")}
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ platform: "facebook", active: true, starts_on: dayjs() }); setEditing("new"); }}>{t("New campaign")}</Button>} />
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={12} md={6}><Kpi title={t("Spent")} value={money(totals.spent)} loading={loading} /></Col>
                <Col xs={12} md={6}><Kpi title={t("Delivered sales")} value={money(totals.revenue)} loading={loading} /></Col>
                <Col xs={12} md={6}><Kpi title={t("Cost per delivered sale")} value={totals.delivered ? money(totals.spent / totals.delivered) : "—"} loading={loading} /></Col>
                <Col xs={12} md={6}><Kpi title={t("Return on ad spend")} value={totals.spent ? `×${(totals.revenue / totals.spent).toFixed(1)}` : "—"} loading={loading} hint={t("Delivered sales divided by what the ads cost.")} /></Col>
            </Row>
            <Card>
                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={data ?? []}
                    scroll={{ x: "max-content" }}
                    columns={[
                        { title: t("Campaign"), dataIndex: "name", render: (v: string, r) => <Button type="link" style={{ padding: 0 }} onClick={() => setViewing(r.id)}>{v}</Button> },
                        { title: t("Platform"), dataIndex: "platform", render: (v: AdPlatform) => <Tag>{t(AD_PLATFORM_LABELS[v])}</Tag> },
                        { title: t("Dates"), key: "d", render: (_, r) => `${formatDate(r.starts_on, locale)} → ${r.ends_on ? formatDate(r.ends_on, locale) : "…"}` },
                        { title: t("Spent"), dataIndex: "spent", align: "right", render: (v: number, r) => <span>{money(v)}{r.budget ? <Text type="secondary" style={{ fontSize: 12 }}> / {money(r.budget)}</Text> : null}</span> },
                        { title: t("Orders"), dataIndex: "orders", align: "right" },
                        { title: t("Delivered"), dataIndex: "delivered", align: "right" },
                        { title: t("Delivered sales"), dataIndex: "revenue", align: "right", render: (v: number) => money(v) },
                        { title: t("Cost per delivered sale"), dataIndex: "cost_per_delivered", align: "right", render: (v: number | null) => (v === null ? "—" : money(v)) },
                        { title: t("Status"), dataIndex: "active", render: (v: boolean) => <Tag color={v ? "green" : "default"}>{t(v ? "Active" : "Ended")}</Tag> },
                        {
                            title: "", key: "a", render: (_, r) => (
                                <Space>
                                    <Button size="small" icon={<DollarOutlined />} onClick={() => { spendForm.resetFields(); spendForm.setFieldsValue({ spend_date: dayjs(), account: "bank" }); setSpending(r); }}>{t("Add spend")}</Button>
                                    <Button size="small" onClick={() => { form.resetFields(); form.setFieldsValue({ ...r, starts_on: r.starts_on ? dayjs(r.starts_on) : null, ends_on: r.ends_on ? dayjs(r.ends_on) : null }); setEditing(r); }}>{t("Edit")}</Button>
                                    <Popconfirm title={t("Delete this campaign?")} onConfirm={() => remove(r.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t("Delete")} /></Popconfirm>
                                </Space>
                            ),
                        },
                    ]}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>{t("Tag orders with their campaign when you create them (New order) or on the order's page.")}</Text>
            </Card>

            <Modal open={editing !== null} title={editing === "new" ? t("New campaign") : t("Edit campaign")} onCancel={() => setEditing(null)} onOk={save} okText={t("Save")} cancelText={t("Cancel")} forceRender>
                <Form form={form} layout="vertical">
                    <Form.Item name="name" label={t("Name")} rules={[{ required: true }]}><Input placeholder={t("Ramadan kachabia promo")} /></Form.Item>
                    <Form.Item name="platform" label={t("Platform")}><Select options={AD_PLATFORMS.map((p) => ({ value: p, label: t(AD_PLATFORM_LABELS[p]) }))} /></Form.Item>
                    <Space wrap>
                        <Form.Item name="starts_on" label={t("Starts")}><DatePicker format="DD/MM/YYYY" /></Form.Item>
                        <Form.Item name="ends_on" label={t("Ends")}><DatePicker format="DD/MM/YYYY" /></Form.Item>
                    </Space>
                    <Form.Item name="budget" label={t("Budget")}><InputNumber min={0} precision={3} style={{ width: "100%" }} suffix="TND" /></Form.Item>
                    <Form.Item name="active" label={t("Active")} valuePropName="checked"><Switch /></Form.Item>
                    <Form.Item name="notes" label={t("Notes")}><Input.TextArea rows={2} /></Form.Item>
                </Form>
            </Modal>

            <Modal open={!!spending} title={t("Spend on {name}", { name: spending?.name ?? "" })} onCancel={() => setSpending(null)} onOk={addSpend} okText={t("Save")} cancelText={t("Cancel")} forceRender>
                <Form form={spendForm} layout="vertical">
                    <Form.Item name="amount" label={t("Amount")} rules={[{ required: true }]}><InputNumber min={0.001} precision={3} style={{ width: "100%" }} suffix="TND" /></Form.Item>
                    <Form.Item name="spend_date" label={t("Date")} rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} /></Form.Item>
                    <Form.Item name="account" label={t("Paid with")}><Select options={[{ value: "bank", label: t("Bank card / transfer") }, { value: "cash", label: t("Cash") }, { value: "payable", label: t("Not paid yet (owed)") }]} /></Form.Item>
                    <Form.Item name="note" label={t("Note")}><Input placeholder={t("Meta invoice number...")} /></Form.Item>
                </Form>
            </Modal>

            <Drawer open={!!viewing} onClose={() => setViewing(null)} title={detail.data?.name} size={480}>
                <Table size="small" rowKey="id" pagination={false} dataSource={detail.data?.spend ?? []} locale={{ emptyText: t("No spend recorded.") }}
                    columns={[
                        { title: t("Date"), dataIndex: "spend_date", render: (v: string) => formatDate(v, locale) },
                        { title: t("Amount"), dataIndex: "amount", render: (v: number) => formatMoney(v, locale) },
                        { title: t("Note"), dataIndex: "note", render: (v: string | null) => v ?? "—" },
                        { title: "", key: "x", render: (_, s) => <Popconfirm title={t("Remove this spend?")} onConfirm={() => removeSpend(s.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t("Remove")} /></Popconfirm> },
                    ]} />
            </Drawer>
        </div>
    );
}
