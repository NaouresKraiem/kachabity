"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { Button, Card, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Upload } from "antd";
import { DeleteOutlined, DownloadOutlined, InboxOutlined, PlusOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd";
import { message } from "@/components/admin/antd-app";
import { useAdminT } from "@/lib/admin-i18n";
import { DOCUMENT_KINDS, DOCUMENT_KIND_LABELS, type DocumentKind } from "@/lib/erp/constants";
import { PageHeader } from "@/components/admin/erp/ui";
import { api, day, formatDate, useApi } from "@/components/admin/erp/erp-client";

interface Doc {
    id: string;
    kind: DocumentKind;
    title: string;
    file_name: string | null;
    size_bytes: number | null;
    partner_name: string | null;
    document_date: string | null;
    expires_on: string | null;
    notes: string | null;
    created_at: string;
    created_by_email: string | null;
}

/**
 * Admin → Documents: contracts, supplier invoices, delivery notes, certificates, tax and payroll
 * papers, kept privately. Documents with an expiry date raise an alert 15 days before.
 */
export default function DocumentsPage() {
    const { t, locale } = useAdminT();
    const [kind, setKind] = useState("");
    const [q, setQ] = useState("");
    const { data, loading, reload } = useApi<Doc[]>(`/api/finance/documents?${kind ? `kind=${kind}&` : ""}${q ? `q=${encodeURIComponent(q)}` : ""}`);
    const [uploading, setUploading] = useState(false);
    const [files, setFiles] = useState<UploadFile[]>([]);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();
    const today = dayjs().format("YYYY-MM-DD");

    const upload = async () => {
        const values = await form.validateFields();
        const body = new FormData();
        const file = files[0]?.originFileObj;
        if (file) body.append("file", file);
        body.append("kind", values.kind);
        body.append("title", values.title);
        if (values.partner_name) body.append("partner_name", values.partner_name);
        if (values.document_date) body.append("document_date", day(values.document_date));
        if (values.expires_on) body.append("expires_on", day(values.expires_on));
        if (values.notes) body.append("notes", values.notes);
        setSaving(true);
        try {
            await api("/api/finance/documents", { method: "POST", body });
            message.success(t("Document saved"));
            setUploading(false);
            setFiles([]);
            form.resetFields();
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        } finally {
            setSaving(false);
        }
    };

    const open = async (id: string) => {
        try {
            const { url } = await api<{ url: string }>(`/api/finance/documents?id=${id}&download=1`);
            window.open(url, "_blank", "noopener");
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    const remove = async (id: string) => {
        try {
            await api(`/api/finance/documents?id=${id}`, { method: "DELETE" });
            reload();
        } catch (e) {
            message.error(t((e as Error).message));
        }
    };

    return (
        <div>
            <PageHeader title={t("Documents")} subtitle={t("Contracts, invoices, delivery notes and certificates, stored privately.")}
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ kind: "supplier_invoice", document_date: dayjs() }); setUploading(true); }}>{t("Add document")}</Button>} />
            <Card>
                <Space wrap style={{ marginBottom: 16 }}>
                    <Select value={kind} onChange={setKind} style={{ width: 200 }} options={[{ value: "", label: t("All types") }, ...DOCUMENT_KINDS.map((k) => ({ value: k, label: t(DOCUMENT_KIND_LABELS[k]) }))]} />
                    <Input.Search allowClear placeholder={t("Title, partner or file")} onSearch={setQ} style={{ width: 260 }} />
                </Space>
                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={data ?? []}
                    scroll={{ x: "max-content" }}
                    columns={[
                        { title: t("Title"), dataIndex: "title", render: (v: string, r) => <span><b>{v}</b><div style={{ fontSize: 12, color: "#8c8c8c" }}>{r.file_name}</div></span> },
                        { title: t("Type"), dataIndex: "kind", render: (v: DocumentKind) => <Tag>{t(DOCUMENT_KIND_LABELS[v])}</Tag> },
                        { title: t("Partner"), dataIndex: "partner_name", render: (v: string | null) => v ?? "—" },
                        { title: t("Date"), dataIndex: "document_date", render: (v: string | null) => formatDate(v, locale) },
                        { title: t("Expires"), dataIndex: "expires_on", render: (v: string | null) => (v ? <Tag color={v < today ? "red" : v <= dayjs().add(15, "day").format("YYYY-MM-DD") ? "orange" : "default"}>{formatDate(v, locale)}</Tag> : "—") },
                        { title: t("Added by"), dataIndex: "created_by_email", render: (v: string | null) => v ?? "—" },
                        {
                            title: "", key: "a", render: (_, r) => (
                                <Space>
                                    {r.file_name && <Button size="small" icon={<DownloadOutlined />} onClick={() => open(r.id)}>{t("Open")}</Button>}
                                    <Popconfirm title={t("Delete this document?")} onConfirm={() => remove(r.id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t("Delete")} /></Popconfirm>
                                </Space>
                            ),
                        },
                    ]}
                />
            </Card>
            <Modal open={uploading} title={t("Add document")} onCancel={() => setUploading(false)} onOk={upload} confirmLoading={saving} okText={t("Save")} cancelText={t("Cancel")} forceRender>
                <Upload.Dragger maxCount={1} fileList={files} beforeUpload={() => false} onChange={({ fileList }) => setFiles(fileList.slice(-1))} accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.xls,.xlsx,.doc,.docx">
                    <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                    <p>{t("Drop a file here or click (PDF, image, spreadsheet, Word · 20 MB max)")}</p>
                </Upload.Dragger>
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="title" label={t("Title")} rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="kind" label={t("Type")}><Select options={DOCUMENT_KINDS.map((k) => ({ value: k, label: t(DOCUMENT_KIND_LABELS[k]) }))} /></Form.Item>
                    <Form.Item name="partner_name" label={t("Supplier, customer or organisation")}><Input /></Form.Item>
                    <Space wrap>
                        <Form.Item name="document_date" label={t("Date")}><DatePicker format="DD/MM/YYYY" /></Form.Item>
                        <Form.Item name="expires_on" label={t("Expires on")}><DatePicker format="DD/MM/YYYY" /></Form.Item>
                    </Space>
                    <Form.Item name="notes" label={t("Notes")}><Input.TextArea rows={2} /></Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
