"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { message } from "@/components/admin/antd-app";
import { useAdminT } from "@/lib/admin-i18n";
import { useAdminRole } from "@/lib/admin-role-context";
import { PageHeader } from "@/components/admin/erp/ui";
import { api, useApi } from "@/components/admin/erp/erp-client";

interface Supplier {
    id: string;
    name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    tax_id: string | null;
    bank_details: string | null;
    payment_terms_days: number;
    kind: string;
    notes: string | null;
}

const KINDS: Record<string, string> = { goods: "Goods for resale", materials: "Raw materials", services: "Services", other: "Other" };

/** Admin → Suppliers: contact details, tax id, bank details and payment terms (due dates of their bills). */
export default function SuppliersPage() {
    const { t } = useAdminT();
    const { can, isAdmin } = useAdminRole();
    const { data, loading, reload } = useApi<Supplier[]>("/api/stock/suppliers");
    const [editing, setEditing] = useState<Supplier | "new" | null>(null);
    const [form] = Form.useForm();

    const open = (supplier: Supplier | "new") => {
        form.resetFields();
        if (supplier !== "new") form.setFieldsValue(supplier);
        setEditing(supplier);
    };

    const save = async () => {
        const values = await form.validateFields();
        try {
            await api("/api/stock/suppliers", { method: editing === "new" ? "POST" : "PUT", body: editing === "new" ? values : { id: (editing as Supplier).id, ...values } });
            message.success(t("Saved"));
            setEditing(null);
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const remove = async (id: string) => {
        try {
            await api(`/api/stock/suppliers?id=${id}`, { method: "DELETE" });
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    return (
        <div>
            <PageHeader
                title={t("Suppliers")}
                subtitle={t("Who you buy from, and their payment terms.")}
                crumbs={[{ title: t("Purchase orders"), href: "/admin/purchasing" }]}
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => open("new")}>{t("New supplier")}</Button>}
            />
            <Card>
                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={data ?? []}
                    scroll={{ x: "max-content" }}
                    columns={[
                        { title: t("Name"), dataIndex: "name", render: (v: string, r) => <span><b>{v}</b>{r.contact_name ? <div style={{ fontSize: 12, color: "#8c8c8c" }}>{r.contact_name}</div> : null}</span> },
                        { title: t("Type"), dataIndex: "kind", render: (v: string) => <Tag>{t(KINDS[v] ?? v)}</Tag> },
                        { title: t("Contact"), key: "c", render: (_, r) => [r.phone, r.email].filter(Boolean).join(" · ") || "—" },
                        { title: t("Tax ID"), dataIndex: "tax_id", render: (v: string | null) => v ?? "—" },
                        { title: t("Payment terms"), dataIndex: "payment_terms_days", render: (v: number) => (v ? t("{days} day(s)", { days: v }) : t("On receipt")) },
                        {
                            title: "", key: "a", render: (_, r) => (
                                <Space>
                                    <Link href={`/admin/purchasing/prices?supplier=${r.id}`}>{t("Prices")}</Link>
                                    <Button size="small" icon={<EditOutlined />} onClick={() => open(r)} aria-label={t("Edit")} />
                                    {(can("delete") || isAdmin) && (
                                        <Popconfirm title={t("Delete this supplier?")} onConfirm={() => remove(r.id)}>
                                            <Button size="small" danger icon={<DeleteOutlined />} aria-label={t("Delete")} />
                                        </Popconfirm>
                                    )}
                                </Space>
                            ),
                        },
                    ]}
                />
            </Card>
            <Modal open={editing !== null} title={editing === "new" ? t("New supplier") : t("Edit supplier")} onCancel={() => setEditing(null)} onOk={save} okText={t("Save")} cancelText={t("Cancel")} width={640} forceRender>
                <Form form={form} layout="vertical" initialValues={{ kind: "goods", payment_terms_days: 0 }}>
                    <Row gutter={12}>
                        <Col span={16}><Form.Item name="name" label={t("Name")} rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col span={8}><Form.Item name="kind" label={t("Type")}><Select options={Object.entries(KINDS).map(([value, label]) => ({ value, label: t(label) }))} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="contact_name" label={t("Contact person")}><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="phone" label={t("Phone")}><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="email" label={t("Email")}><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="tax_id" label={t("Tax ID (matricule fiscal)")}><Input /></Form.Item></Col>
                        <Col span={24}><Form.Item name="address" label={t("Address")}><Input /></Form.Item></Col>
                        <Col span={16}><Form.Item name="bank_details" label={t("Bank details (RIB)")}><Input /></Form.Item></Col>
                        <Col span={8}><Form.Item name="payment_terms_days" label={t("Pay within (days)")}><InputNumber min={0} max={365} style={{ width: "100%" }} /></Form.Item></Col>
                        <Col span={24}><Form.Item name="notes" label={t("Notes")}><Input.TextArea rows={2} /></Form.Item></Col>
                    </Row>
                </Form>
            </Modal>
        </div>
    );
}
