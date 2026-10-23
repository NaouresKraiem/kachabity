"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { Button, Card, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tabs, Tag, Typography } from "antd";
import { DeleteOutlined, DollarOutlined, PlusOutlined } from "@ant-design/icons";
import { message } from "@/components/admin/antd-app";
import { useAdminT } from "@/lib/admin-i18n";
import { BILL_CATEGORIES, BILL_CATEGORY_ACCOUNTS, BILL_CATEGORY_LABELS, FIXED_CATEGORIES, type BillCategory } from "@/lib/erp/constants";
import { Kpi, PageHeader } from "@/components/admin/erp/ui";
import { api, day, formatDate, formatMoney, useApi } from "@/components/admin/erp/erp-client";

const { Text } = Typography;

interface Bill {
    id: string;
    number: string;
    supplier_id: string | null;
    payee: string | null;
    supplier: { name: string } | null;
    purchase_order: { id: string; number: string } | null;
    supplier_reference: string | null;
    category: BillCategory;
    cost_type: "fixed" | "variable";
    account_code: string;
    bill_date: string;
    due_date: string | null;
    amount_ht: number;
    vat_amount: number;
    stamp: number;
    total: number;
    paid_amount: number;
    status: "unpaid" | "partial" | "paid";
    notes: string | null;
    payments?: { id: string; amount: number; paid_on: string; account: string; method: string; reference: string | null }[];
}

const STATUS_COLORS = { unpaid: "red", partial: "orange", paid: "green" } as const;
const STATUS_LABELS = { unpaid: "Unpaid", partial: "Partly paid", paid: "Paid" } as const;

/**
 * Admin → Bills & expenses. Supplier invoices and every other cost (rent, salaries, utilities,
 * packaging...), fixed or variable, with due dates and what is still owed. Each bill and each
 * payment books itself into the accounts.
 */
export default function BillsPage() {
    const { t, locale } = useAdminT();
    const [status, setStatus] = useState("open");
    const [category, setCategory] = useState("");
    const { data, loading, reload } = useApi<Bill[]>(`/api/finance/bills?${status !== "all" ? `status=${status}&` : ""}${category ? `category=${category}` : ""}`);
    const suppliers = useApi<{ id: string; name: string; payment_terms_days: number }[]>("/api/stock/suppliers");
    const [editing, setEditing] = useState<Bill | "new" | null>(null);
    const [viewing, setViewing] = useState<string | null>(null);
    const bill = useApi<Bill>(viewing ? `/api/finance/bills?id=${viewing}` : null);
    const [paying, setPaying] = useState<Bill | null>(null);
    const [form] = Form.useForm();
    const [payForm] = Form.useForm();
    const money = (n: number) => formatMoney(n, locale);
    const today = dayjs().format("YYYY-MM-DD");

    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get("id");
        const s = new URLSearchParams(window.location.search).get("status");
        if (id) setViewing(id);
        if (s) setStatus(s);
    }, []);

    const totals = useMemo(() => {
        const rows = data ?? [];
        const owed = rows.reduce((s, b) => s + Number(b.total) - Number(b.paid_amount), 0);
        const overdue = rows.filter((b) => b.status !== "paid" && b.due_date && b.due_date < today).reduce((s, b) => s + Number(b.total) - Number(b.paid_amount), 0);
        const week = rows.filter((b) => b.status !== "paid" && b.due_date && b.due_date <= dayjs().add(7, "day").format("YYYY-MM-DD")).reduce((s, b) => s + Number(b.total) - Number(b.paid_amount), 0);
        return { owed, overdue, week };
    }, [data, today]);

    const open = (b: Bill | "new") => {
        form.resetFields();
        if (b === "new") form.setFieldsValue({ category: "rent", cost_type: "fixed", bill_date: dayjs(), vat_amount: 0, stamp: 0, account_code: BILL_CATEGORY_ACCOUNTS.rent });
        else form.setFieldsValue({ ...b, bill_date: dayjs(b.bill_date), due_date: b.due_date ? dayjs(b.due_date) : null });
        setEditing(b);
    };

    const save = async () => {
        const values = await form.validateFields();
        const body = {
            supplier_id: values.supplier_id ?? null,
            payee: values.payee ?? null,
            supplier_reference: values.supplier_reference ?? null,
            category: values.category,
            cost_type: values.cost_type,
            account_code: values.account_code,
            bill_date: day(values.bill_date),
            due_date: values.due_date ? day(values.due_date) : editing === "new" ? undefined : null,
            amount_ht: values.amount_ht,
            vat_amount: values.vat_amount ?? 0,
            stamp: values.stamp ?? 0,
            notes: values.notes ?? null,
        };
        try {
            if (editing === "new") {
                await api("/api/finance/bills", { method: "POST", body: { ...body, ...(values.paid_now ? { paid_now: { account: values.paid_account ?? "bank", method: values.paid_account === "cash" ? "cash" : "bank_transfer" } } : {}) } });
            } else {
                await api("/api/finance/bills", { method: "PUT", body: { id: (editing as Bill).id, ...body } });
            }
            message.success(t("Saved"));
            setEditing(null);
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const pay = async () => {
        const values = await payForm.validateFields();
        try {
            await api("/api/finance/bills", { method: "PATCH", body: { action: "pay", bill_id: paying!.id, amount: values.amount, paid_on: day(values.paid_on), account: values.account, method: values.method, reference: values.reference || undefined } });
            message.success(t("Payment recorded"));
            setPaying(null);
            reload();
            bill.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const unpay = async (paymentId: string) => {
        try {
            await api("/api/finance/bills", { method: "PATCH", body: { action: "unpay", payment_id: paymentId } });
            reload();
            bill.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const remove = async (id: string) => {
        try {
            await api(`/api/finance/bills?id=${id}`, { method: "DELETE" });
            setViewing(null);
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const who = (b: Bill) => b.supplier?.name ?? b.payee ?? "—";

    return (
        <div>
            <PageHeader
                title={t("Bills & expenses")}
                subtitle={t("Supplier invoices and running costs, what is due and what is paid.")}
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => open("new")}>{t("New bill or expense")}</Button>}
            />
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} md={8}><Kpi title={t("Still to pay (shown)")} value={money(totals.owed)} loading={loading} /></Col>
                <Col xs={12} md={8}><Kpi title={t("Due within 7 days")} value={money(totals.week)} loading={loading} color={totals.week > 0 ? "#d48806" : undefined} /></Col>
                <Col xs={12} md={8}><Kpi title={t("Overdue")} value={money(totals.overdue)} loading={loading} color={totals.overdue > 0 ? "#cf1322" : undefined} /></Col>
            </Row>
            <Card>
                <Tabs activeKey={status} onChange={setStatus} items={[
                    { key: "open", label: t("To pay") },
                    { key: "overdue", label: t("Overdue") },
                    { key: "paid", label: t("Paid") },
                    { key: "all", label: t("All") },
                ]} />
                <Select value={category} onChange={setCategory} style={{ width: 240, marginBottom: 16 }} options={[{ value: "", label: t("All categories") }, ...BILL_CATEGORIES.map((c) => ({ value: c, label: t(BILL_CATEGORY_LABELS[c]) }))]} />
                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={data ?? []}
                    scroll={{ x: "max-content" }}
                    onRow={(r) => ({ onClick: () => setViewing(r.id), style: { cursor: "pointer" } })}
                    columns={[
                        { title: t("Date"), dataIndex: "bill_date", render: (v: string) => formatDate(v, locale) },
                        { title: t("Supplier / paid to"), key: "who", render: (_, r) => <span><b>{who(r)}</b><div style={{ fontSize: 12, color: "#8c8c8c" }}>{r.supplier_reference ?? r.number}</div></span> },
                        { title: t("Category"), dataIndex: "category", render: (v: BillCategory, r) => <span>{t(BILL_CATEGORY_LABELS[v])} {r.cost_type === "fixed" && <Tag>{t("Fixed")}</Tag>}</span> },
                        { title: t("Total"), dataIndex: "total", align: "right", render: (v: number) => money(v) },
                        { title: t("Still owed"), key: "owed", align: "right", render: (_, r) => money(Number(r.total) - Number(r.paid_amount)) },
                        { title: t("Due"), dataIndex: "due_date", render: (v: string | null, r) => (v ? <span style={{ color: r.status !== "paid" && v < today ? "#cf1322" : undefined }}>{formatDate(v, locale)}</span> : "—") },
                        { title: t("Status"), dataIndex: "status", render: (v: Bill["status"]) => <Tag color={STATUS_COLORS[v]}>{t(STATUS_LABELS[v])}</Tag> },
                        {
                            title: "", key: "pay", render: (_, r) => r.status !== "paid" && (
                                <Button size="small" icon={<DollarOutlined />} onClick={(e) => { e.stopPropagation(); payForm.resetFields(); payForm.setFieldsValue({ amount: Number(r.total) - Number(r.paid_amount), paid_on: dayjs(), account: "bank", method: "bank_transfer" }); setPaying(r); }}>{t("Pay")}</Button>
                            ),
                        },
                    ]}
                />
            </Card>

            <Drawer open={!!viewing} onClose={() => setViewing(null)} size={560} title={bill.data ? `${who(bill.data)} · ${bill.data.supplier_reference ?? bill.data.number}` : ""}
                extra={bill.data && <Space><Button onClick={() => open(bill.data!)}>{t("Edit")}</Button>{Number(bill.data.paid_amount) === 0 && <Popconfirm title={t("Cancel this bill?")} description={t("Its accounting entry is reversed.")} onConfirm={() => remove(bill.data!.id)}><Button danger>{t("Cancel bill")}</Button></Popconfirm>}</Space>}>
                {bill.data && (
                    <>
                        <Descriptions column={1} size="small" bordered>
                            <Descriptions.Item label={t("Category")}>{t(BILL_CATEGORY_LABELS[bill.data.category])} ({bill.data.account_code}) · {t(bill.data.cost_type === "fixed" ? "Fixed" : "Variable")}</Descriptions.Item>
                            <Descriptions.Item label={t("Date")}>{formatDate(bill.data.bill_date, locale)}</Descriptions.Item>
                            <Descriptions.Item label={t("Due")}>{bill.data.due_date ? formatDate(bill.data.due_date, locale) : "—"}</Descriptions.Item>
                            <Descriptions.Item label={t("Before VAT")}>{money(bill.data.amount_ht)}</Descriptions.Item>
                            <Descriptions.Item label={t("VAT")}>{money(bill.data.vat_amount)}</Descriptions.Item>
                            {Number(bill.data.stamp) > 0 && <Descriptions.Item label={t("Stamp duty")}>{money(bill.data.stamp)}</Descriptions.Item>}
                            <Descriptions.Item label={t("Total")}><b>{money(bill.data.total)}</b></Descriptions.Item>
                            {bill.data.purchase_order && <Descriptions.Item label={t("Purchase order")}><Link href={`/admin/purchasing/${bill.data.purchase_order.id}`}>{bill.data.purchase_order.number}</Link></Descriptions.Item>}
                            {bill.data.notes && <Descriptions.Item label={t("Notes")}>{bill.data.notes}</Descriptions.Item>}
                        </Descriptions>
                        <Text strong style={{ display: "block", marginTop: 16 }}>{t("Payments")}</Text>
                        <Table size="small" rowKey="id" pagination={false} dataSource={bill.data.payments ?? []} locale={{ emptyText: t("Not paid yet.") }}
                            columns={[
                                { title: t("Date"), dataIndex: "paid_on", render: (v: string) => formatDate(v, locale) },
                                { title: t("Amount"), dataIndex: "amount", render: (v: number) => money(v) },
                                { title: t("From"), dataIndex: "account", render: (v: string) => t(v === "cash" ? "Cash register" : "Bank") },
                                { title: t("Reference"), dataIndex: "reference", render: (v: string | null) => v ?? "—" },
                                { title: "", key: "x", render: (_, p) => <Popconfirm title={t("Remove this payment?")} onConfirm={() => unpay(p.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t("Remove")} /></Popconfirm> },
                            ]} />
                        {bill.data.status !== "paid" && <Button style={{ marginTop: 12 }} type="primary" icon={<DollarOutlined />} onClick={() => { payForm.resetFields(); payForm.setFieldsValue({ amount: Number(bill.data!.total) - Number(bill.data!.paid_amount), paid_on: dayjs(), account: "bank", method: "bank_transfer" }); setPaying(bill.data!); }}>{t("Pay")}</Button>}
                    </>
                )}
            </Drawer>

            <Modal open={editing !== null} title={editing === "new" ? t("New bill or expense") : t("Edit bill")} onCancel={() => setEditing(null)} onOk={save} okText={t("Save")} cancelText={t("Cancel")} width={680} forceRender>
                <Form form={form} layout="vertical">
                    <Row gutter={12}>
                        <Col xs={24} md={12}>
                            <Form.Item name="category" label={t("What is it?")} rules={[{ required: true }]}>
                                <Select
                                    options={BILL_CATEGORIES.map((c) => ({ value: c, label: t(BILL_CATEGORY_LABELS[c]) }))}
                                    onChange={(c: BillCategory) => form.setFieldsValue({ account_code: BILL_CATEGORY_ACCOUNTS[c], cost_type: FIXED_CATEGORIES.includes(c) ? "fixed" : "variable" })}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={12} md={6}><Form.Item name="cost_type" label={t("Cost type")}><Select options={[{ value: "fixed", label: t("Fixed") }, { value: "variable", label: t("Variable") }]} /></Form.Item></Col>
                        <Col xs={12} md={6}><Form.Item name="account_code" label={t("Account")} rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col xs={24} md={12}>
                            <Form.Item name="supplier_id" label={t("Supplier")}>
                                <Select allowClear showSearch optionFilterProp="label" options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}><Form.Item name="payee" label={t("Or paid to")} tooltip={t("Landlord, employee, utility company... when they are not a supplier.")}><Input /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item name="supplier_reference" label={t("Invoice number")}><Input /></Form.Item></Col>
                        <Col xs={12} md={8}><Form.Item name="bill_date" label={t("Date")} rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" /></Form.Item></Col>
                        <Col xs={12} md={8}><Form.Item name="due_date" label={t("Due date")} tooltip={t("Empty: from the supplier's payment terms.")}><DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" /></Form.Item></Col>
                        <Col xs={8}><Form.Item name="amount_ht" label={t("Before VAT")} rules={[{ required: true }]}><InputNumber min={0} precision={3} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col xs={8}><Form.Item name="vat_amount" label={t("VAT")}><InputNumber min={0} precision={3} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col xs={8}><Form.Item name="stamp" label={t("Stamp duty")}><InputNumber min={0} precision={3} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col xs={24}><Form.Item name="notes" label={t("Notes")}><Input.TextArea rows={2} /></Form.Item></Col>
                        {editing === "new" && (
                            <>
                                <Col xs={12}><Form.Item name="paid_now" label={t("Already paid")} valuePropName="checked"><Switch /></Form.Item></Col>
                                <Col xs={12}>
                                    <Form.Item noStyle shouldUpdate>
                                        {() => form.getFieldValue("paid_now") && (
                                            <Form.Item name="paid_account" label={t("Paid from")} initialValue="bank"><Select options={[{ value: "bank", label: t("Bank") }, { value: "cash", label: t("Cash register") }]} /></Form.Item>
                                        )}
                                    </Form.Item>
                                </Col>
                            </>
                        )}
                    </Row>
                </Form>
            </Modal>

            <Modal open={!!paying} title={t("Pay {who}", { who: paying ? who(paying) : "" })} onCancel={() => setPaying(null)} onOk={pay} okText={t("Save")} cancelText={t("Cancel")} forceRender>
                <Form form={payForm} layout="vertical">
                    <Form.Item name="amount" label={t("Amount")} rules={[{ required: true }]}><InputNumber min={0.001} precision={3} style={{ width: "100%" }} suffix="TND" /></Form.Item>
                    <Form.Item name="paid_on" label={t("Date")} rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" /></Form.Item>
                    <Row gutter={12}>
                        <Col span={12}><Form.Item name="account" label={t("Paid from")}><Select options={[{ value: "bank", label: t("Bank") }, { value: "cash", label: t("Cash register") }]} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="method" label={t("Method")}><Select options={[{ value: "bank_transfer", label: t("Bank transfer") }, { value: "check", label: t("Cheque") }, { value: "cash", label: t("Cash") }, { value: "card", label: t("Card") }, { value: "other", label: t("Other") }]} /></Form.Item></Col>
                    </Row>
                    <Form.Item name="reference" label={t("Reference")}><Input placeholder={t("Cheque or transfer number")} /></Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
