"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    Button,
    Card,
    Breadcrumb,
    Input,
    Popconfirm,
    Table,
    Typography,
    Space,
    Modal,
    Form,
    Tabs,
} from "antd";
import { message } from "@/components/admin/antd-app";
import { useAdminRole } from "@/lib/admin-role-context";
import type { ColumnsType } from "antd/es/table";
import {
    DeleteOutlined,
    PlusOutlined,
    EditOutlined,
    SearchOutlined,
    ReloadOutlined,
    AppstoreOutlined,
} from "@ant-design/icons";
import { useAdminT } from "@/lib/admin-i18n";

const { Title, Text } = Typography;

interface ColorRow {
    id: string;
    name: string;
    hex_code?: string | null;
    display_name?: string | null;
    sort_order: number;
}

interface SizeRow {
    id: string;
    name: string;
    display_name?: string | null;
    sort_order: number;
}

export default function AdminVariantsPage() {
    const { t } = useAdminT();
    const canDelete = useAdminRole().can("delete");
    const [colors, setColors] = useState<ColorRow[]>([]);
    const [sizes, setSizes] = useState<SizeRow[]>([]);
    const [loading, setLoading] = useState(true); // first fetch starts on mount: show the table spinner right away
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedColorKeys, setSelectedColorKeys] = useState<string[]>([]);
    const [selectedSizeKeys, setSelectedSizeKeys] = useState<string[]>([]);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [isColorModalOpen, setIsColorModalOpen] = useState(false);
    const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
    const [editingColor, setEditingColor] = useState<ColorRow | null>(null);
    const [editingSize, setEditingSize] = useState<SizeRow | null>(null);
    const [colorForm] = Form.useForm();
    const [sizeForm] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("colors");

    // Fetch colors
    const fetchColors = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/colors");
            if (!response.ok) throw new Error("Failed to fetch");
            const result = await response.json();
            if (result.success) {
                setColors(result.data || []);
            }
        } catch (error: any) {
            console.error("Fetch error:", error);
            message.error(t("Failed to fetch colors"));
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch sizes
    const fetchSizes = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/sizes");
            if (!response.ok) throw new Error("Failed to fetch");
            const result = await response.json();
            if (result.success) {
                setSizes(result.data || []);
            }
        } catch (error: any) {
            console.error("Fetch error:", error);
            message.error(t("Failed to fetch sizes"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchColors();
        fetchSizes();
    }, [fetchColors, fetchSizes]);

    const filteredColors = useMemo(() => {
        return colors.filter((color) =>
            (color.display_name || color.name).toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [colors, searchTerm]);

    const filteredSizes = useMemo(() => {
        return sizes.filter((size) =>
            (size.display_name || size.name).toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [sizes, searchTerm]);

    // Color handlers
    const handleDeleteColor = async (color: ColorRow) => {
        try {
            const response = await fetch(`/api/colors?id=${color.id}`, { method: "DELETE" });
            const result = await response.json();
            if (result.success) {
                message.success(t("Color deleted"));
                fetchColors();
            } else {
                message.error(result.error || t("Failed to delete"));
            }
        } catch (error) {
            message.error(t("Failed to delete color"));
        }
    };

    const handleBulkDeleteColors = async () => {
        if (selectedColorKeys.length === 0) return;
        setBulkDeleting(true);
        try {
            // One request, one statement: all selected colors are deleted or none.
            const response = await fetch(`/api/colors?ids=${selectedColorKeys.join(",")}`, { method: "DELETE" });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) throw new Error(result?.error || "Delete failed");
            message.success(t("Deleted {count} color(s)", { count: selectedColorKeys.length }));
            setSelectedColorKeys([]);
            fetchColors();
        } catch (error) {
            message.error(t("Failed to delete colors"));
        } finally {
            setBulkDeleting(false);
        }
    };

    const handleOpenColorModal = (color?: ColorRow) => {
        if (color) {
            setEditingColor(color);
            colorForm.setFieldsValue({
                display_name: color.display_name || color.name,
                hex_code: color.hex_code || "#000000",
            });
        } else {
            setEditingColor(null);
            colorForm.resetFields();
            colorForm.setFieldsValue({ hex_code: "#000000" });
        }
        setIsColorModalOpen(true);
    };

    const handleColorSubmit = async (values: any) => {
        setSubmitting(true);
        try {
            const payload = {
                name: values.display_name.toLowerCase().replace(/\s+/g, '-'),
                display_name: values.display_name,
                hex_code: values.hex_code,
                sort_order: 0,
            };

            const method = editingColor ? "PUT" : "POST";
            const body = editingColor ? { ...payload, id: editingColor.id } : payload;

            const response = await fetch("/api/colors", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const result = await response.json();
            if (result.success) {
                message.success((editingColor ? t("Color updated") : t("Color created")));
                setIsColorModalOpen(false);
                colorForm.resetFields();
                fetchColors();
            } else {
                message.error(result.error || t("Failed to save"));
            }
        } catch (error) {
            message.error(t("Failed to save color"));
        } finally {
            setSubmitting(false);
        }
    };

    // Size handlers
    const handleDeleteSize = async (size: SizeRow) => {
        try {
            const response = await fetch(`/api/sizes?id=${size.id}`, { method: "DELETE" });
            const result = await response.json();
            if (result.success) {
                message.success(t("Size deleted"));
                fetchSizes();
            } else {
                message.error(result.error || t("Failed to delete"));
            }
        } catch (error) {
            message.error(t("Failed to delete size"));
        }
    };

    const handleBulkDeleteSizes = async () => {
        if (selectedSizeKeys.length === 0) return;
        setBulkDeleting(true);
        try {
            // One request, one statement: all selected sizes are deleted or none.
            const response = await fetch(`/api/sizes?ids=${selectedSizeKeys.join(",")}`, { method: "DELETE" });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) throw new Error(result?.error || "Delete failed");
            message.success(t("Deleted {count} size(s)", { count: selectedSizeKeys.length }));
            setSelectedSizeKeys([]);
            fetchSizes();
        } catch (error) {
            message.error(t("Failed to delete sizes"));
        } finally {
            setBulkDeleting(false);
        }
    };

    const handleOpenSizeModal = (size?: SizeRow) => {
        if (size) {
            setEditingSize(size);
            sizeForm.setFieldsValue({
                display_name: size.display_name || size.name,
            });
        } else {
            setEditingSize(null);
            sizeForm.resetFields();
        }
        setIsSizeModalOpen(true);
    };

    const handleSizeSubmit = async (values: any) => {
        setSubmitting(true);
        try {
            const payload = {
                name: values.display_name.toUpperCase(),
                display_name: values.display_name,
                sort_order: 0,
            };

            const method = editingSize ? "PUT" : "POST";
            const body = editingSize ? { ...payload, id: editingSize.id } : payload;

            const response = await fetch("/api/sizes", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const result = await response.json();
            if (result.success) {
                message.success((editingSize ? t("Size updated") : t("Size created")));
                setIsSizeModalOpen(false);
                sizeForm.resetFields();
                fetchSizes();
            } else {
                message.error(result.error || t("Failed to save"));
            }
        } catch (error) {
            message.error(t("Failed to save size"));
        } finally {
            setSubmitting(false);
        }
    };

    // Table columns
    const colorColumns: ColumnsType<ColorRow> = [
        {
            title: t("Preview"),
            key: "preview",
            width: 80,
            render: (_: any, record: ColorRow) => (
                <div
                    style={{
                        width: 40,
                        height: 40,
                        backgroundColor: record.hex_code || "#ccc",
                        border: "2px solid #d9d9d9",
                        borderRadius: 6,
                    }}
                />
            ),
        },
        {
            title: t("Color Name"),
            dataIndex: "display_name",
            key: "display_name",
            sorter: (a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name),
            render: (display_name: string | null, record: ColorRow) => (
                <div style={{ fontWeight: 500 }}>
                    {display_name || record.name}
                </div>
            ),
        },
        {
            title: t("Hex Code"),
            dataIndex: "hex_code",
            key: "hex_code",
            render: (hex: string | null) => hex || "—",
        },
        {
            title: t("Action"),
            key: "action",
            width: 150,
            render: (_: any, record: ColorRow) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleOpenColorModal(record)}
                    >
                        {t("Edit")}
                    </Button>
                    {canDelete && (
                        <Popconfirm
                            title={t("Delete color?")}
                            description={t("Remove \"{name}\"?", { name: record.display_name || record.name })}
                            onConfirm={() => handleDeleteColor(record)}
                        >
                            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                                {t("Delete")}
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    const sizeColumns: ColumnsType<SizeRow> = [
        {
            title: t("Size Name"),
            dataIndex: "display_name",
            key: "display_name",
            sorter: (a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name),
            render: (display_name: string | null, record: SizeRow) => (
                <div style={{ fontWeight: 500 }}>
                    {display_name || record.name}
                </div>
            ),
        },
        {
            title: t("Code"),
            dataIndex: "name",
            key: "name",
            render: (name: string) => (
                <span style={{ fontFamily: "monospace", background: "#f5f5f5", padding: "2px 8px", borderRadius: 4 }}>
                    {name}
                </span>
            ),
        },
        {
            title: t("Action"),
            key: "action",
            width: 150,
            render: (_: any, record: SizeRow) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleOpenSizeModal(record)}
                    >
                        {t("Edit")}
                    </Button>
                    {canDelete && (
                        <Popconfirm
                            title={t("Delete size?")}
                            description={t("Remove \"{name}\"?", { name: record.display_name || record.name })}
                            onConfirm={() => handleDeleteSize(record)}
                        >
                            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                                {t("Delete")}
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
                <Breadcrumb
                    items={[
                        { title: <Link href="/admin/dashboard">{t("Dashboard")}</Link> },
                        { title: t("Variants") },
                    ]}
                />
                <div
                    style={{
                        marginTop: 16,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 24,
                        flexWrap: "wrap",
                    }}
                >
                    <div>
                        <Title level={2} style={{ margin: 0, fontWeight: 600 }}>
                            <AppstoreOutlined style={{ marginRight: 12 }} />
                            {t("Product Variants")}
                        </Title>
                        <Text type="secondary">
                            {t("Manage colors and sizes for your products")}
                        </Text>
                    </div>
                </div>
            </div>

            <Card>
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                        {
                            key: "colors",
                            label: t("🎨 Colors"),
                            children: (
                                <>
                                    <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 12 }}>
                                        <Input
                                            placeholder={t("Search colors...")}
                                            prefix={<SearchOutlined />}
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{ maxWidth: 300 }}
                                        />
                                        <Space>
                                            {selectedColorKeys.length > 0 && canDelete && (
                                                    <Popconfirm
                                                        title={t("Delete {count} color(s)?", { count: selectedColorKeys.length })}
                                                        onConfirm={handleBulkDeleteColors}
                                                    >
                                                        <Button danger icon={<DeleteOutlined />} loading={bulkDeleting}>
                                                            {t("Delete ({count})", { count: selectedColorKeys.length })}
                                                        </Button>
                                                    </Popconfirm>
                                            )}
                                            <Button icon={<ReloadOutlined />} onClick={fetchColors}>
                                                {t("Refresh")}
                                            </Button>
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={() => handleOpenColorModal()}
                                                style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}
                                            >
                                                {t("Add Color")}
                                            </Button>
                                        </Space>
                                    </div>
                                    <Table
                                        rowKey="id"
                                        loading={loading}
                                        dataSource={filteredColors}
                                        columns={colorColumns}
                                        rowSelection={{
                                            selectedRowKeys: selectedColorKeys,
                                            onChange: (keys) => setSelectedColorKeys(keys as string[]),
                                        }}
                                        pagination={{ pageSize: 10 }}
                                    />
                                </>
                            ),
                        },
                        {
                            key: "sizes",
                            label: t("📏 Sizes"),
                            children: (
                                <>
                                    <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 12 }}>
                                        <Input
                                            placeholder={t("Search sizes...")}
                                            prefix={<SearchOutlined />}
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{ maxWidth: 300 }}
                                        />
                                        <Space>
                                            {selectedSizeKeys.length > 0 && canDelete && (
                                                    <Popconfirm
                                                        title={t("Delete {count} size(s)?", { count: selectedSizeKeys.length })}
                                                        onConfirm={handleBulkDeleteSizes}
                                                    >
                                                        <Button danger icon={<DeleteOutlined />} loading={bulkDeleting}>
                                                            {t("Delete ({count})", { count: selectedSizeKeys.length })}
                                                        </Button>
                                                    </Popconfirm>
                                            )}
                                            <Button icon={<ReloadOutlined />} onClick={fetchSizes}>
                                                {t("Refresh")}
                                            </Button>
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={() => handleOpenSizeModal()}
                                                style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}
                                            >
                                                {t("Add Size")}
                                            </Button>
                                        </Space>
                                    </div>
                                    <Table
                                        rowKey="id"
                                        loading={loading}
                                        dataSource={filteredSizes}
                                        columns={sizeColumns}
                                        rowSelection={{
                                            selectedRowKeys: selectedSizeKeys,
                                            onChange: (keys) => setSelectedSizeKeys(keys as string[]),
                                        }}
                                        pagination={{ pageSize: 10 }}
                                    />
                                </>
                            ),
                        },
                    ]}
                />
            </Card>

            {/* Color Modal */}
            <Modal
                title={editingColor ? t("Edit Color") : t("Add Color")}
                open={isColorModalOpen}
                onCancel={() => setIsColorModalOpen(false)}
                footer={null}
                width={500}
            >
                <Form form={colorForm} layout="vertical" onFinish={handleColorSubmit} style={{ marginTop: 24 }}>
                    <Form.Item
                        label={t("Color Name")}
                        name="display_name"
                        rules={[{ required: true, message: t("Enter color name") }]}
                    >
                        <Input placeholder={t("e.g., Sky Blue, Cherry Red")} size="large" />
                    </Form.Item>

                    <Form.Item
                        label={t("Color")}
                        name="hex_code"
                        rules={[{ required: true, message: t("Select a color") }]}
                    >
                        <Input
                            type="color"
                            style={{ width: "100%", height: 50, cursor: "pointer" }}
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                        <Space>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={submitting}
                                size="large"
                                style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}
                            >
                                {editingColor ? t("Update") : t("Create")}
                            </Button>
                            <Button onClick={() => setIsColorModalOpen(false)} size="large">
                                {t("Cancel")}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Size Modal */}
            <Modal
                title={editingSize ? t("Edit Size") : t("Add Size")}
                open={isSizeModalOpen}
                onCancel={() => setIsSizeModalOpen(false)}
                footer={null}
                width={500}
            >
                <Form form={sizeForm} layout="vertical" onFinish={handleSizeSubmit} style={{ marginTop: 24 }}>
                    <Form.Item
                        label={t("Size Name")}
                        name="display_name"
                        rules={[{ required: true, message: t("Enter size name") }]}
                    >
                        <Input placeholder={t("e.g., Small, Medium, Large, XL")} size="large" />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                        <Space>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={submitting}
                                size="large"
                                style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}
                            >
                                {editingSize ? t("Update") : t("Create")}
                            </Button>
                            <Button onClick={() => setIsSizeModalOpen(false)} size="large">
                                {t("Cancel")}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}



