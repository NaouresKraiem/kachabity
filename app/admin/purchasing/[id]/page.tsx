"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import dayjs, { type Dayjs } from "dayjs";
import { Alert, Button, Card, Col, DatePicker, Descriptions, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography } from "antd";
import { DeleteOutlined, InboxOutlined, PlusOutlined, PrinterOutlined } from "@ant-design/icons";
import { message } from "@/components/admin/antd-app";
import { useAdminT } from "@/lib/admin-i18n";
import { useAdminRole } from "@/lib/admin-role-context";
import { PO_STATUS_COLORS, PO_STATUS_LABELS, type PurchaseOrderStatus } from "@/lib/erp/constants";
import { searchByText } from "@/components/admin/select-search";
import { PageHeader } from "@/components/admin/erp/ui";
import { api, day, formatDate, formatMoney, useApi } from "@/components/admin/erp/erp-client";
import { usePurchaseItems } from "@/components/admin/erp/purchase-items";

const { Text } = Typography;

interface Line {
    id?: string;
    key: string;
    item?: string;              // "v:<id>" | "m:<id>"
    description: string;
    quantity: number | null;
    unit_cost: number | null;
    vat_rate: number;
    received_quantity?: number;
    rejected_quantity?: number;
}

interface PurchaseOrder {
    id: string;
    number: string;
    status: PurchaseOrderStatus;
    supplier_id: string;
    supplier: { id: string; name: string; phone: string | null; email: string | null; payment_terms_days: number } | null;
    order_date: string;
    expected_date: string | null;
    location_id: string | null;
    location: { name: string } | null;
    notes: string | null;
    subtotal: number;
    vat_amount: number;
    total: number;
    lines: {
        id: string; variant_id: string | null; material_id: string | null; description: string; quantity: number; unit_cost: number; vat_rate: number;
        received_quantity: number; rejected_quantity: number;
        variant: { sku: string | null; product: { name: string } | null; colors: { name: string; display_name: string | null } | null; sizes: { name: string } | null } | null;
        material: { name: string; unit: string } | null;
    }[];
    receipts: { id: string; number: string; status: string; received_on: string; validated_by_email: string | null; notes: string | null; lines: { po_line_id: string; quantity_accepted: number; quantity_rejected: number; reject_reason: string | null }[] }[];
    bills: { id: string; number: string; supplier_reference: string | null; total: number; paid_amount: number; status: string; due_date: string | null }[];
}

interface Supplier { id: string; name: string }
interface Location { id: string; name: string; sells_online: boolean }

let nextKey = 1;

/**
 * A purchase order (or price request): its lines, sending it, receiving the goods with a quality
 * check (accepted / rejected per line), and the supplier's bill. "new" creates one.
 */
export default function PurchaseOrderPage() {
    const { t, locale } = useAdminT();
    const { id } = useParams<{ id: string }>();
    const isNew = id === "new";
    const router = useRouter();
    const { can } = useAdminRole();
    const po = useApi<PurchaseOrder>(isNew ? null : `/api/purchasing/orders?id=${id}`);
    const suppliers = useApi<Supplier[]>("/api/stock/suppliers");
    const locations = useApi<Location[]>("/api/stock/locations");
    const items = usePurchaseItems();
    const [form] = Form.useForm();
    const [lines, setLines] = useState<Line[]>([{ key: `n${nextKey++}`, description: "", quantity: null, unit_cost: null, vat_rate: 19 }]);
    const [saving, setSaving] = useState(false);
    const [receiving, setReceiving] = useState(false);
    const [received, setReceived] = useState<Record<string, { accepted: number; rejected: number; reason: string }>>({});
    const [receiptMeta, setReceiptMeta] = useState<{ date: Dayjs; location_id?: string; notes: string; validate: boolean }>({ date: dayjs(), notes: "", validate: true });
    const [billOpen, setBillOpen] = useState(false);
    const [billForm] = Form.useForm();

    const order = po.data;
    const editable = isNew || (order && ["draft", "rfq", "ordered"].includes(order.status));
    const itemByValue = useMemo(() => new Map(items.map((i) => [i.value, i])), [items]);

    useEffect(() => {
        if (!order) return;
        form.setFieldsValue({
            supplier_id: order.supplier_id,
            order_date: dayjs(order.order_date),
            expected_date: order.expected_date ? dayjs(order.expected_date) : null,
            location_id: order.location_id,
            notes: order.notes,
        });
        setLines(order.lines.map((l) => ({
            id: l.id,
            key: l.id,
            item: l.variant_id ? `v:${l.variant_id}` : l.material_id ? `m:${l.material_id}` : undefined,
            description: l.description,
            quantity: Number(l.quantity),
            unit_cost: Number(l.unit_cost),
            vat_rate: Number(l.vat_rate),
            received_quantity: Number(l.received_quantity),
            rejected_quantity: Number(l.rejected_quantity),
        })));
    }, [order, form]);

    useEffect(() => {
        if (isNew && locations.data && !form.getFieldValue("location_id")) {
            form.setFieldValue("location_id", (locations.data.find((l) => l.sells_online) ?? locations.data[0])?.id);
        }
    }, [isNew, locations.data, form]);

    const totals = lines.reduce((s, l) => {
        const ht = (l.quantity ?? 0) * (l.unit_cost ?? 0);
        return { ht: s.ht + ht, vat: s.vat + (ht * l.vat_rate) / 100 };
    }, { ht: 0, vat: 0 });
    const update = (key: string, patch: Partial<Line>) => setLines((list) => list.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    const money = (n: number) => formatMoney(n, locale);

    const save = async (status?: string) => {
        const values = await form.validateFields();
        const payload = lines.filter((l) => (l.item || l.description) && l.quantity).map((l) => ({
            ...(l.id ? { id: l.id } : {}),
            variant_id: l.item?.startsWith("v:") ? l.item.slice(2) : null,
            material_id: l.item?.startsWith("m:") ? l.item.slice(2) : null,
            description: l.description || (l.item ? itemByValue.get(l.item)?.label ?? "" : ""),
            quantity: l.quantity,
            unit_cost: l.unit_cost ?? 0,
            vat_rate: l.vat_rate,
        }));
        if (!payload.length) {
            message.warning(t("Add at least one line with a quantity."));
            return;
        }
        setSaving(true);
        try {
            const saved = await api<{ id: string }>("/api/purchasing/orders", {
                method: "POST",
                body: {
                    ...(isNew ? {} : { id }),
                    supplier_id: values.supplier_id,
                    order_date: values.order_date ? day(values.order_date) : undefined,
                    expected_date: values.expected_date ? day(values.expected_date) : null,
                    location_id: values.location_id ?? null,
                    notes: values.notes ?? null,
                    ...(status ? { status } : {}),
                    lines: payload,
                },
            });
            message.success(t("Purchase order saved"));
            if (isNew) router.replace(`/admin/purchasing/${saved.id}`);
            else po.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        } finally {
            setSaving(false);
        }
    };

    const setStatus = async (status: PurchaseOrderStatus) => {
        try {
            await api("/api/purchasing/orders", { method: "PATCH", body: { id, status } });
            po.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const startReceiving = () => {
        const init: typeof received = {};
        for (const l of order?.lines ?? []) {
            const left = Math.max(0, Number(l.quantity) - Number(l.received_quantity));
            init[l.id] = { accepted: left, rejected: 0, reason: "" };
        }
        setReceived(init);
        setReceiptMeta({ date: dayjs(), location_id: order?.location_id ?? undefined, notes: "", validate: true });
        setReceiving(true);
    };

    const receive = async () => {
        try {
            await api("/api/purchasing/receipts", {
                method: "POST",
                body: {
                    purchase_order_id: id,
                    received_on: day(receiptMeta.date),
                    location_id: receiptMeta.location_id ?? null,
                    notes: receiptMeta.notes || undefined,
                    validate: receiptMeta.validate,
                    lines: Object.entries(received).filter(([, r]) => r.accepted + r.rejected > 0).map(([po_line_id, r]) => ({
                        po_line_id, quantity_accepted: r.accepted, quantity_rejected: r.rejected, reject_reason: r.reason || undefined,
                    })),
                },
            });
            message.success(receiptMeta.validate ? t("Goods received and added to stock") : t("Receipt saved, waiting for the check"));
            setReceiving(false);
            po.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const receiptAction = async (receiptId: string, action: "validate" | "cancel") => {
        try {
            await api("/api/purchasing/receipts", { method: "PUT", body: { id: receiptId, action } });
            po.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const createBill = async () => {
        const values = await billForm.validateFields();
        try {
            await api("/api/finance/bills", {
                method: "POST",
                body: {
                    supplier_id: order!.supplier_id,
                    purchase_order_id: id,
                    supplier_reference: values.supplier_reference,
                    category: order!.lines.some((l) => l.material_id) && !order!.lines.some((l) => l.variant_id) ? "purchase_materials" : "purchase_goods",
                    bill_date: day(values.bill_date),
                    amount_ht: values.amount_ht,
                    vat_amount: values.vat_amount ?? 0,
                    stamp: values.stamp ?? 0,
                },
            });
            message.success(t("Bill recorded"));
            setBillOpen(false);
            po.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const itemOptions = items.map((i) => ({ value: i.value, label: i.label, searchtext: i.searchtext }));

    return (
        <div>
            <PageHeader
                title={isNew ? t("New purchase order") : order ? order.number : "…"}
                subtitle={order ? <Space><Tag color={PO_STATUS_COLORS[order.status]}>{t(PO_STATUS_LABELS[order.status])}</Tag>{order.supplier?.name}</Space> : t("Ask a supplier for prices, or order from them.")}
                crumbs={[{ title: t("Purchase orders"), href: "/admin/purchasing" }]}
                extra={order && (
                    <>
                        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>{t("Print")}</Button>
                        {order.status === "draft" && <Button onClick={() => setStatus("rfq")}>{t("Mark as price request sent")}</Button>}
                        {["draft", "rfq"].includes(order.status) && <Button type="primary" onClick={() => setStatus("ordered")}>{t("Place the order")}</Button>}
                        {["ordered", "partial"].includes(order.status) && <Button type="primary" icon={<InboxOutlined />} onClick={startReceiving}>{t("Receive goods")}</Button>}
                        {order.status === "partial" && <Popconfirm title={t("Close this order? The missing goods won't come.")} onConfirm={() => setStatus("received")}><Button>{t("Close as received")}</Button></Popconfirm>}
                        {["draft", "rfq", "ordered"].includes(order.status) && <Popconfirm title={t("Cancel this purchase order?")} onConfirm={() => setStatus("cancelled")}><Button danger>{t("Cancel order")}</Button></Popconfirm>}
                    </>
                )}
            />
            {po.error && <Alert type="error" showIcon title={t(po.error)} />}

            <Card loading={!isNew && po.loading}>
                <Form form={form} layout="vertical" disabled={!editable} initialValues={{ order_date: dayjs() }}>
                    <Row gutter={12}>
                        <Col xs={24} md={8}>
                            <Form.Item name="supplier_id" label={t("Supplier")} rules={[{ required: true }]}>
                                <Select showSearch optionFilterProp="label" options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))} notFoundContent={<Link href="/admin/purchasing/suppliers">{t("Add a supplier")}</Link>} />
                            </Form.Item>
                        </Col>
                        <Col xs={12} md={4}><Form.Item name="order_date" label={t("Date")}><DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" /></Form.Item></Col>
                        <Col xs={12} md={4}><Form.Item name="expected_date" label={t("Expected")}><DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" /></Form.Item></Col>
                        <Col xs={24} md={8}>
                            <Form.Item name="location_id" label={t("Deliver products to")}>
                                <Select options={(locations.data ?? []).map((l) => ({ value: l.id, label: l.name }))} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Table
                        size="small"
                        rowKey="key"
                        pagination={false}
                        dataSource={lines}
                        scroll={{ x: "max-content" }}
                        columns={[
                            {
                                title: t("Item"), key: "item", width: 360, render: (_, l) => (
                                    <Space orientation="vertical" style={{ width: "100%" }} size={2}>
                                        <Select
                                            showSearch
                                            allowClear
                                            filterOption={searchByText}
                                            placeholder={t("Product or raw material")}
                                            value={l.item}
                                            options={itemOptions}
                                            style={{ width: 340 }}
                                            disabled={!editable || (l.received_quantity ?? 0) > 0}
                                            onChange={(item) => update(l.key, { item, unit_cost: l.unit_cost ?? itemByValue.get(item)?.cost ?? null })}
                                        />
                                        {!l.item && <Input placeholder={t("Or describe it")} value={l.description} disabled={!editable} onChange={(e) => update(l.key, { description: e.target.value })} style={{ width: 340 }} />}
                                    </Space>
                                ),
                            },
                            { title: t("Qty"), key: "q", render: (_, l) => <InputNumber min={0.001} value={l.quantity} disabled={!editable} onChange={(v) => update(l.key, { quantity: v === null ? null : Number(v) })} style={{ width: 90 }} /> },
                            { title: t("Unit cost (before VAT)"), key: "c", render: (_, l) => <InputNumber min={0} precision={3} value={l.unit_cost} disabled={!editable} onChange={(v) => update(l.key, { unit_cost: v === null ? null : Number(v) })} style={{ width: 130 }} /> },
                            { title: t("VAT %"), key: "v", render: (_, l) => <Select value={l.vat_rate} disabled={!editable} onChange={(v) => update(l.key, { vat_rate: v })} style={{ width: 80 }} options={[0, 7, 13, 19].map((r) => ({ value: r, label: `${r}%` }))} /> },
                            { title: t("Total"), key: "tot", align: "right", render: (_, l) => money((l.quantity ?? 0) * (l.unit_cost ?? 0)) },
                            ...(!isNew ? [{ title: t("Received"), key: "rec", render: (_: unknown, l: Line) => <span>{l.received_quantity ?? 0}{(l.rejected_quantity ?? 0) > 0 && <Text type="danger"> (−{l.rejected_quantity})</Text>}</span> }] : []),
                            { title: "", key: "x", render: (_, l) => editable && !(l.received_quantity ?? 0) && <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setLines((list) => list.filter((x) => x.key !== l.key))} aria-label={t("Remove line")} /> },
                        ]}
                        footer={() => (
                            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                                {editable ? <Button icon={<PlusOutlined />} onClick={() => setLines((list) => [...list, { key: `n${nextKey++}`, description: "", quantity: null, unit_cost: null, vat_rate: 19 }])}>{t("Add line")}</Button> : <span />}
                                <span>{t("Before VAT")}: <b>{money(totals.ht)}</b> · {t("VAT")}: <b>{money(totals.vat)}</b> · {t("Total")}: <b>{money(totals.ht + totals.vat)}</b></span>
                            </div>
                        )}
                    />
                    <Form.Item name="notes" label={t("Notes")} style={{ marginTop: 16 }}><Input.TextArea rows={2} /></Form.Item>
                </Form>
                {editable && (
                    <Space>
                        <Button type="primary" loading={saving} onClick={() => save()}>{t("Save")}</Button>
                        {isNew && <Button loading={saving} onClick={() => save("rfq")}>{t("Save as price request")}</Button>}
                    </Space>
                )}
            </Card>

            {order && (
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                    <Col xs={24} lg={14}>
                        <Card title={t("Goods received")}>
                            <Table
                                size="small"
                                rowKey="id"
                                pagination={false}
                                dataSource={order.receipts}
                                locale={{ emptyText: t("Nothing received yet.") }}
                                columns={[
                                    { title: t("Receipt"), dataIndex: "number" },
                                    { title: t("Date"), dataIndex: "received_on", render: (v: string) => formatDate(v, locale) },
                                    { title: t("Accepted / rejected"), key: "q", render: (_, r) => `${r.lines.reduce((s, l) => s + Number(l.quantity_accepted), 0)} / ${r.lines.reduce((s, l) => s + Number(l.quantity_rejected), 0)}` },
                                    { title: t("Status"), dataIndex: "status", render: (v: string, r) => <Tag color={v === "validated" ? "green" : v === "pending" ? "orange" : "default"}>{t(v === "validated" ? "In stock" : v === "pending" ? "To check" : "Cancelled")}{r.validated_by_email ? ` · ${r.validated_by_email}` : ""}</Tag> },
                                    {
                                        title: "", key: "a", render: (_, r) => r.status === "pending" && (
                                            <Space>
                                                <Button size="small" type="primary" onClick={() => receiptAction(r.id, "validate")}>{t("Validate")}</Button>
                                                <Button size="small" onClick={() => receiptAction(r.id, "cancel")}>{t("Cancel")}</Button>
                                            </Space>
                                        ),
                                    },
                                ]}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} lg={10}>
                        <Card title={t("Supplier bills")} extra={can("finance") && order.status !== "cancelled" && <Button size="small" icon={<PlusOutlined />} onClick={() => { billForm.resetFields(); billForm.setFieldsValue({ bill_date: dayjs(), amount_ht: Number(order.subtotal), vat_amount: Number(order.vat_amount), stamp: 1 }); setBillOpen(true); }}>{t("Record bill")}</Button>}>
                            <Descriptions size="small" column={1}>
                                <Descriptions.Item label={t("Order total")}>{money(Number(order.total))}</Descriptions.Item>
                                <Descriptions.Item label={t("Payment terms")}>{t("{days} day(s)", { days: order.supplier?.payment_terms_days ?? 0 })}</Descriptions.Item>
                            </Descriptions>
                            {order.bills.map((b) => (
                                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: "1px solid #f5f5f5" }}>
                                    <Link href={`/admin/finance/bills?id=${b.id}`}>{b.supplier_reference ?? b.number}</Link>
                                    <span>{money(Number(b.total))} <Tag color={b.status === "paid" ? "green" : b.status === "partial" ? "orange" : "red"}>{t(b.status === "paid" ? "Paid" : b.status === "partial" ? "Partly paid" : "Unpaid")}</Tag></span>
                                </div>
                            ))}
                            {!order.bills.length && <Text type="secondary">{t("No bill recorded yet.")}</Text>}
                        </Card>
                    </Col>
                </Row>
            )}

            <Modal open={receiving} title={t("Receive goods")} width={820} onCancel={() => setReceiving(false)} onOk={receive} okText={receiptMeta.validate ? t("Validate and add to stock") : t("Save, check later")} cancelText={t("Cancel")} forceRender>
                <Space wrap style={{ marginBottom: 12 }}>
                    <DatePicker value={receiptMeta.date} onChange={(d) => d && setReceiptMeta({ ...receiptMeta, date: d })} format="DD/MM/YYYY" />
                    <Select value={receiptMeta.location_id} onChange={(v) => setReceiptMeta({ ...receiptMeta, location_id: v })} style={{ width: 200 }} options={(locations.data ?? []).map((l) => ({ value: l.id, label: l.name }))} placeholder={t("Location")} />
                    <Select value={receiptMeta.validate} onChange={(v) => setReceiptMeta({ ...receiptMeta, validate: v })} style={{ width: 260 }} options={[{ value: true, label: t("Checked: add to stock now") }, { value: false, label: t("Not checked yet: keep pending") }]} />
                </Space>
                <Table
                    size="small"
                    rowKey="id"
                    pagination={false}
                    dataSource={order?.lines ?? []}
                    scroll={{ x: "max-content" }}
                    columns={[
                        { title: t("Item"), key: "i", render: (_, l) => l.material?.name ?? (l.variant ? `${l.variant.product?.name ?? ""} ${[l.variant.colors?.display_name || l.variant.colors?.name, l.variant.sizes?.name].filter(Boolean).join(" / ")}` : l.description) },
                        { title: t("Left to receive"), key: "left", render: (_, l) => Math.max(0, Number(l.quantity) - Number(l.received_quantity)) },
                        { title: t("Accepted"), key: "a", render: (_, l) => <InputNumber min={0} value={received[l.id]?.accepted} onChange={(v) => setReceived({ ...received, [l.id]: { ...received[l.id], accepted: Number(v) || 0 } })} style={{ width: 90 }} /> },
                        { title: t("Rejected"), key: "r", render: (_, l) => <InputNumber min={0} value={received[l.id]?.rejected} onChange={(v) => setReceived({ ...received, [l.id]: { ...received[l.id], rejected: Number(v) || 0 } })} style={{ width: 90 }} /> },
                        { title: t("Why rejected"), key: "w", render: (_, l) => (received[l.id]?.rejected ?? 0) > 0 && <Input value={received[l.id]?.reason} onChange={(e) => setReceived({ ...received, [l.id]: { ...received[l.id], reason: e.target.value } })} placeholder={t("Damaged, wrong colour...")} style={{ width: 180 }} /> },
                    ]}
                />
                <Input.TextArea style={{ marginTop: 12 }} rows={2} placeholder={t("Notes (delivery note number...)")} value={receiptMeta.notes} onChange={(e) => setReceiptMeta({ ...receiptMeta, notes: e.target.value })} />
            </Modal>

            <Modal open={billOpen} title={t("Record the supplier's bill")} onCancel={() => setBillOpen(false)} onOk={createBill} okText={t("Save")} cancelText={t("Cancel")} forceRender>
                <Form form={billForm} layout="vertical">
                    <Form.Item name="supplier_reference" label={t("Their invoice number")} rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="bill_date" label={t("Invoice date")} rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" /></Form.Item>
                    <Row gutter={8}>
                        <Col span={8}><Form.Item name="amount_ht" label={t("Before VAT")} rules={[{ required: true }]}><InputNumber min={0} precision={3} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="vat_amount" label={t("VAT")}><InputNumber min={0} precision={3} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="stamp" label={t("Stamp duty")}><InputNumber min={0} precision={3} style={{ width: "100%" }} /></Form.Item></Col>
                    </Row>
                    <Text type="secondary">{t("The due date follows the supplier's payment terms. Pay it from Bills & expenses.")}</Text>
                </Form>
            </Modal>
        </div>
    );
}
