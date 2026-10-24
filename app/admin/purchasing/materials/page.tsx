"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Col, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tabs, Tag, Typography } from "antd";
import { BuildOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SwapOutlined } from "@ant-design/icons";
import { message } from "@/components/admin/antd-app";
import { useAdminT } from "@/lib/admin-i18n";
import { MATERIAL_UNITS } from "@/lib/erp/constants";
import { searchByText } from "@/components/admin/select-search";
import { PageHeader } from "@/components/admin/erp/ui";
import { api, formatMoney, useApi } from "@/components/admin/erp/erp-client";

const { Text } = Typography;

interface Material {
    id: string;
    name: string;
    code: string | null;
    unit: string;
    stock: number;
    avg_cost: number | null;
    reorder_point: number;
    notes: string | null;
    supplier_id: string | null;
    supplier: { id: string; name: string } | null;
}

interface CostRow {
    product_id: string;
    product_name: string;
    code: string | null;
    base_price: number;
    materials_cost: number | null;
    labor_cost: number;
    overhead_cost: number;
    stock_avg_cost: number | null;
    purchase_cost: number | null;
    cost_price: number | null;
    margin: number | null;
    margin_percent: number | null;
}

interface Costing {
    bom: { material_id: string; quantity: number; material: { name: string; unit: string; avg_cost: number | null } }[];
    costing: { labor_cost: number; overhead_cost: number; notes: string | null } | null;
}

/**
 * Admin → Raw materials & costs. Raw materials (fabric, thread...) with their stock and average
 * cost; and the cost price of each model: materials per unit (bill of materials) + labor +
 * overhead, compared with the selling price. Production runs consume materials and add the
 * finished units to stock at cost price.
 */
export default function MaterialsPage() {
    const { t, locale } = useAdminT();
    const [tab, setTab] = useState("materials");
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get("tab") === "costs") setTab("costs");
    }, []);
    const materials = useApi<Material[]>("/api/purchasing/materials");
    const costs = useApi<CostRow[]>("/api/purchasing/costing");
    const suppliers = useApi<{ id: string; name: string }[]>("/api/stock/suppliers");
    const locations = useApi<{ id: string; name: string; sells_online: boolean }[]>("/api/stock/locations");
    const [editing, setEditing] = useState<Material | "new" | null>(null);
    const [moving, setMoving] = useState<Material | null>(null);
    const [form] = Form.useForm();
    const [moveForm] = Form.useForm();
    const [product, setProduct] = useState<CostRow | null>(null);
    const money = (n: number | null | undefined, digits = 3) => (n === null || n === undefined ? "—" : formatMoney(n, locale, digits));

    const saveMaterial = async () => {
        const values = await form.validateFields();
        try {
            await api("/api/purchasing/materials", { method: editing === "new" ? "POST" : "PUT", body: editing === "new" ? values : { id: (editing as Material).id, ...values } });
            setEditing(null);
            materials.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const move = async () => {
        const values = await moveForm.validateFields();
        try {
            await api("/api/purchasing/materials", { method: "PATCH", body: { id: moving!.id, ...values } });
            setMoving(null);
            materials.reload();
            costs.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const remove = async (id: string) => {
        try {
            await api(`/api/purchasing/materials?id=${id}`, { method: "DELETE" });
            materials.reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const materialsValue = (materials.data ?? []).reduce((s, m) => s + Number(m.stock) * Number(m.avg_cost ?? 0), 0);

    return (
        <div>
            <PageHeader title={t("Raw materials & costs")} subtitle={t("Materials in the workshop, and what each model really costs to make.")} />
            <Tabs
                activeKey={tab}
                onChange={setTab}
                items={[
                    {
                        key: "materials",
                        label: t("Raw materials"),
                        children: (
                            <Card
                                title={t("Value in stock: {amount}", { amount: money(materialsValue, 0) })}
                                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEditing("new"); }}>{t("New material")}</Button>}
                            >
                                <Table
                                    rowKey="id"
                                    loading={materials.loading}
                                    dataSource={materials.data ?? []}
                                    scroll={{ x: "max-content" }}
                                    columns={[
                                        { title: t("Material"), dataIndex: "name", render: (v: string, r) => <span><b>{v}</b>{r.code && <Text type="secondary"> · {r.code}</Text>}</span> },
                                        { title: t("Supplier"), key: "s", render: (_, r) => r.supplier?.name ?? "—" },
                                        { title: t("In stock"), key: "stock", render: (_, r) => <span>{Number(r.stock)} {r.unit} {Number(r.stock) <= Number(r.reorder_point) && <Tag color="orange">{t("Low")}</Tag>}</span> },
                                        { title: t("Average cost"), dataIndex: "avg_cost", render: (v: number | null, r) => (v === null ? "—" : `${money(v)} / ${r.unit}`) },
                                        { title: t("Value"), key: "v", align: "right", render: (_, r) => money(Number(r.stock) * Number(r.avg_cost ?? 0)) },
                                        {
                                            title: "", key: "a", render: (_, r) => (
                                                <Space>
                                                    <Button size="small" icon={<SwapOutlined />} onClick={() => { moveForm.resetFields(); moveForm.setFieldsValue({ type: "purchase", quantity: null, unit_cost: r.avg_cost, note: "" }); setMoving(r); }}>{t("Stock")}</Button>
                                                    <Button size="small" icon={<EditOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue(r); setEditing(r); }} aria-label={t("Edit")} />
                                                    <Popconfirm title={t("Delete this material?")} onConfirm={() => remove(r.id)}><Button size="small" danger icon={<DeleteOutlined />} aria-label={t("Delete")} /></Popconfirm>
                                                </Space>
                                            ),
                                        },
                                    ]}
                                />
                            </Card>
                        ),
                    },
                    {
                        key: "costs",
                        label: t("Cost price per model"),
                        children: (
                            <Card>
                                <Alert type="info" showIcon style={{ marginBottom: 12 }} title={t("Each product has one cost, used for margins and statistics: the purchase cost on its product page. For products made in the workshop, saving their bill of materials (materials + labor + overhead) sets that cost.")} />
                                <Table
                                    rowKey="product_id"
                                    loading={costs.loading}
                                    dataSource={costs.data ?? []}
                                    scroll={{ x: "max-content" }}
                                    pagination={{ pageSize: 50 }}
                                    columns={[
                                        { title: t("Model"), dataIndex: "product_name", render: (v: string, r) => <span><Button type="link" style={{ padding: 0 }} onClick={() => setProduct(r)}>{v}</Button> <Link href={`/admin/products/${r.product_id}/edit`} style={{ fontSize: 12 }}>{t("Edit product")}</Link></span> },
                                        { title: t("Selling price"), dataIndex: "base_price", align: "right", render: (v: number) => money(v, 0) },
                                        { title: t("Materials"), dataIndex: "materials_cost", align: "right", render: (v: number | null) => money(v) },
                                        { title: t("Labor + overhead"), key: "lo", align: "right", render: (_, r) => (r.materials_cost === null ? "—" : money(Number(r.labor_cost) + Number(r.overhead_cost))) },
                                        { title: t("Product cost"), dataIndex: "purchase_cost", align: "right", render: (v: number | null, r) => (v === null ? <Tag color="orange">{r.stock_avg_cost !== null ? t("Not set (restock average {amount})", { amount: money(r.stock_avg_cost) }) : t("Not set")}</Tag> : money(v)) },
                                        { title: t("Cost price"), dataIndex: "cost_price", align: "right", render: (v: number | null) => (v === null ? <Tag color="orange">{t("Unknown")}</Tag> : <b>{money(v)}</b>) },
                                        { title: t("Margin"), dataIndex: "margin_percent", align: "right", render: (v: number | null, r) => (v === null ? "—" : <Tag color={v >= 50 ? "green" : v >= 25 ? "gold" : "red"}>{v}% · {money(r.margin, 0)}</Tag>) },
                                    ]}
                                />
                            </Card>
                        ),
                    },
                ]}
            />

            <Modal open={editing !== null} title={editing === "new" ? t("New material") : t("Edit material")} onCancel={() => setEditing(null)} onOk={saveMaterial} okText={t("Save")} cancelText={t("Cancel")} forceRender>
                <Form form={form} layout="vertical" initialValues={{ unit: "m", reorder_point: 0 }}>
                    <Form.Item name="name" label={t("Name")} rules={[{ required: true }]}><Input placeholder={t("Linen fabric, gold thread...")} /></Form.Item>
                    <Row gutter={12}>
                        <Col span={12}><Form.Item name="code" label={t("Code")}><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="unit" label={t("Unit")}><Select options={MATERIAL_UNITS.map((u) => ({ value: u, label: u }))} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="supplier_id" label={t("Usual supplier")}><Select allowClear showSearch optionFilterProp="label" options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="reorder_point" label={t("Alert below")}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
                    </Row>
                    <Form.Item name="notes" label={t("Notes")}><Input.TextArea rows={2} /></Form.Item>
                </Form>
            </Modal>

            <Modal open={!!moving} title={t("Stock of {name}", { name: moving?.name ?? "" })} onCancel={() => setMoving(null)} onOk={move} okText={t("Save")} cancelText={t("Cancel")} forceRender>
                <Form form={moveForm} layout="vertical">
                    <Form.Item name="type" label={t("What happened")}>
                        <Select options={[
                            { value: "purchase", label: t("Bought (or opening stock)") },
                            { value: "consumption", label: t("Used in the workshop") },
                            { value: "adjustment", label: t("Correction after a count (+/−)") },
                            { value: "return", label: t("Returned to stock") },
                        ]} />
                    </Form.Item>
                    <Form.Item name="quantity" label={t("Quantity ({unit})", { unit: moving?.unit ?? "" })} rules={[{ required: true }]}><InputNumber style={{ width: "100%" }} /></Form.Item>
                    <Form.Item noStyle shouldUpdate>
                        {() => moveForm.getFieldValue("type") === "purchase" && (
                            <Form.Item name="unit_cost" label={t("Cost per unit")}><InputNumber min={0} precision={4} style={{ width: "100%" }} suffix="TND" /></Form.Item>
                        )}
                    </Form.Item>
                    <Form.Item name="note" label={t("Note")}><Input /></Form.Item>
                </Form>
            </Modal>

            <CostingDrawer product={product} onClose={() => setProduct(null)} onSaved={() => costs.reload()} materials={materials.data ?? []} locations={locations.data ?? []} />
        </div>
    );
}

function CostingDrawer({ product, onClose, onSaved, materials, locations }: {
    product: CostRow | null;
    onClose: () => void;
    onSaved: () => void;
    materials: Material[];
    locations: { id: string; name: string; sells_online: boolean }[];
}) {
    const { t, locale } = useAdminT();
    const detail = useApi<Costing>(product ? `/api/purchasing/costing?product_id=${product.product_id}` : null);
    const variants = useApi<{ id: string; sku: string | null; colors: { name: string } | null; sizes: { name: string } | null }[]>(product ? `/api/variants?product_id=${product.product_id}` : null);
    const [bom, setBom] = useState<{ material_id?: string; quantity: number | null }[]>([]);
    const [labor, setLabor] = useState(0);
    const [overhead, setOverhead] = useState(0);
    const [production, setProduction] = useState<{ variant_id?: string; quantity: number | null; location_id?: string }>({ quantity: null });
    const money = (n: number) => formatMoney(n, locale);

    useEffect(() => {
        if (!detail.data) return;
        setBom(detail.data.bom.map((b) => ({ material_id: b.material_id, quantity: Number(b.quantity) })));
        setLabor(Number(detail.data.costing?.labor_cost ?? 0));
        setOverhead(Number(detail.data.costing?.overhead_cost ?? 0));
    }, [detail.data]);

    const byId = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);
    const materialsCost = bom.reduce((s, b) => s + (b.quantity ?? 0) * Number(byId.get(b.material_id ?? "")?.avg_cost ?? 0), 0);
    const cost = materialsCost + labor + overhead;

    const save = async () => {
        try {
            await api("/api/purchasing/costing", {
                method: "PUT",
                body: { product_id: product!.product_id, labor_cost: labor, overhead_cost: overhead, bom: bom.filter((b) => b.material_id && b.quantity).map((b) => ({ material_id: b.material_id, quantity: b.quantity })) },
            });
            message.success(t("Saved"));
            onSaved();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const produce = async () => {
        try {
            const result = await api<{ reference: string; unit_cost: number }>("/api/purchasing/costing", { method: "POST", body: { ...production } });
            message.success(t("Production {reference} recorded at {amount} per unit", { reference: result.reference, amount: money(result.unit_cost) }));
            setProduction({ quantity: null });
            onSaved();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    return (
        <Drawer open={!!product} onClose={onClose} title={product?.product_name} size={620} extra={<Button type="primary" onClick={save}>{t("Save")}</Button>}>
            <Text strong>{t("Materials for one unit")}</Text>
            {bom.map((b, i) => (
                <Space key={i} style={{ display: "flex", marginTop: 8 }} wrap>
                    <Select
                        showSearch
                        filterOption={searchByText}
                        value={b.material_id}
                        style={{ width: 260 }}
                        placeholder={t("Material")}
                        onChange={(material_id) => setBom((list) => list.map((x, j) => (j === i ? { ...x, material_id } : x)))}
                        options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})`, searchtext: m.name }))}
                    />
                    <InputNumber min={0} value={b.quantity} onChange={(v) => setBom((list) => list.map((x, j) => (j === i ? { ...x, quantity: v === null ? null : Number(v) } : x)))} style={{ width: 110 }} suffix={byId.get(b.material_id ?? "")?.unit} />
                    <Text type="secondary">{money((b.quantity ?? 0) * Number(byId.get(b.material_id ?? "")?.avg_cost ?? 0))}</Text>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setBom((list) => list.filter((_, j) => j !== i))} aria-label={t("Remove")} />
                </Space>
            ))}
            <Button style={{ marginTop: 8 }} icon={<PlusOutlined />} onClick={() => setBom((list) => [...list, { quantity: null }])}>{t("Add material")}</Button>
            <Row gutter={12} style={{ marginTop: 16 }}>
                <Col span={12}><Text>{t("Labor per unit")}</Text><InputNumber min={0} precision={3} value={labor} onChange={(v) => setLabor(Number(v) || 0)} style={{ width: "100%" }} suffix="TND" /></Col>
                <Col span={12}><Text>{t("Overhead per unit")}</Text><InputNumber min={0} precision={3} value={overhead} onChange={(v) => setOverhead(Number(v) || 0)} style={{ width: "100%" }} suffix="TND" /></Col>
            </Row>
            <Card size="small" style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("Materials")}</span><span>{money(materialsCost)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("Labor + overhead")}</span><span>{money(labor + overhead)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}><span>{t("Cost price")}</span><span>{money(cost)}</span></div>
                {product && <div style={{ display: "flex", justifyContent: "space-between" }}><span>{t("Selling price")}</span><span>{money(Number(product.base_price))} · {product.base_price > 0 ? `${Math.round(((product.base_price - cost) / product.base_price) * 100)}%` : "—"}</span></div>}
                {bom.some((b) => b.material_id && b.quantity) && (
                    <Text type="secondary" style={{ display: "block", marginTop: 6, fontSize: 12 }}>{t("Saving sets this product's cost to {amount}, used for its margins and statistics.", { amount: money(cost) })}</Text>
                )}
            </Card>

            <Card size="small" style={{ marginTop: 16 }} title={<span><BuildOutlined /> {t("Record a production run")}</span>}>
                <Text type="secondary">{t("Uses the saved bill of materials: the materials leave the workshop stock and the units enter stock at cost price.")}</Text>
                <Space wrap style={{ marginTop: 8 }}>
                    <Select
                        style={{ width: 200 }}
                        placeholder={t("Size/colour")}
                        value={production.variant_id}
                        onChange={(variant_id) => setProduction({ ...production, variant_id })}
                        options={(variants.data ?? []).map((v) => ({ value: v.id, label: [v.colors?.name, v.sizes?.name].filter(Boolean).join(" / ") || v.sku || v.id }))}
                    />
                    <InputNumber min={1} placeholder={t("Qty")} value={production.quantity} onChange={(v) => setProduction({ ...production, quantity: v === null ? null : Number(v) })} />
                    <Select style={{ width: 160 }} placeholder={t("Location")} value={production.location_id} onChange={(location_id) => setProduction({ ...production, location_id })} options={locations.map((l) => ({ value: l.id, label: l.name }))} />
                    <Button type="primary" disabled={!production.variant_id || !production.quantity || !production.location_id} onClick={produce}>{t("Record")}</Button>
                </Space>
            </Card>
            {detail.data && !detail.data.bom.length && <Alert style={{ marginTop: 12 }} type="warning" showIcon title={t("Save a bill of materials before recording production.")} />}
        </Drawer>
    );
}
