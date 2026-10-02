"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Button,
    Card,
    Breadcrumb,
    Input,
    Popconfirm,
    Table,
    Tag,
    Typography,
    Space,
    Image,
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
} from "@ant-design/icons";
import { useAdminT } from "@/lib/admin-i18n";

const { Title, Text } = Typography;

interface CategoryRow {
    id: string;
    name: string;
    slug: string;
    sort_order: number;
    is_featured: boolean;
    image_url?: string | null;
    name_ar?: string | null;
    name_fr?: string | null;
}

export default function AdminCategoriesPage() {
    const { t } = useAdminT();
    const canDelete = useAdminRole().can("delete");
    const router = useRouter();
    const [categories, setCategories] = useState<CategoryRow[]>([]);
    const [loading, setLoading] = useState(true); // first fetch starts on mount: show the table spinner right away
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const [bulkDeleting, setBulkDeleting] = useState(false);

    const fetchCategories = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/categories");

            if (!response.ok) {
                const text = await response.text();
                console.error("API Error:", response.status, text);
                message.error(t("Failed to load categories: {status}", { status: response.status }));
                return;
            }

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                console.error("Expected JSON but got:", contentType, text.substring(0, 100));
                message.error(t("Server returned invalid response"));
                return;
            }

            const result = await response.json();
            if (result.success) {
                setCategories(result.data || []);
            } else {
                message.error(result.error || t("Unable to load categories"));
            }
        } catch (error: any) {
            console.error("Fetch error:", error);
            message.error(t("Failed to fetch categories: {error}", { error: error.message || t("Unknown error") }));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const filteredCategories = useMemo(() => {
        return categories.filter((category) => {
            const matchesSearch =
                category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                category.slug.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        });
    }, [categories, searchTerm]);

    const handleDelete = async (category: CategoryRow) => {
        try {
            const response = await fetch(`/api/categories?id=${category.id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const text = await response.text();
                console.error("Delete API Error:", response.status, text);
                message.error(t("Failed to delete: {status}", { status: response.status }));
                return;
            }

            const result = await response.json();
            if (result.success) {
                message.success(t("Deleted {name}", { name: category.name }));
                fetchCategories();
            } else {
                message.error(result.error || t("Unable to delete category"));
            }
        } catch (error: any) {
            console.error("Delete error:", error);
            message.error(t("Failed to delete category: {error}", { error: error.message || t("Unknown error") }));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning(t("No categories selected"));
            return;
        }

        setBulkDeleting(true);
        try {
            // One request: the server deletes all selected categories in a single transaction, or none.
            const response = await fetch(`/api/categories?ids=${selectedRowKeys.join(",")}`, { method: "DELETE" });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) {
                throw new Error(result?.error || "Delete failed");
            }
            const successCount = selectedRowKeys.length;
            const failCount = 0;

            if (successCount > 0) {
                message.success(t("Successfully deleted {count} categor(ies)", { count: successCount }));
            }
            if (failCount > 0) {
                message.error(t("Failed to delete {count} categor(ies)", { count: failCount }));
            }

            setSelectedRowKeys([]);
            fetchCategories();
        } catch (error: any) {
            console.error("Bulk delete error:", error);
            message.error(t("Failed to delete categories: {error}", { error: error.message || t("Unknown error") }));
        } finally {
            setBulkDeleting(false);
        }
    };

    const columns: ColumnsType<CategoryRow> = [
        {
            title: t("Image"),
            key: "image",
            width: 100,
            render: (_: any, record: CategoryRow) => {
                return record.image_url ? (
                    <Image
                        src={record.image_url}
                        alt={record.name}
                        width={60}
                        height={60}
                        style={{ objectFit: "cover", borderRadius: 4 }}
                        preview={false}
                    />
                ) : (
                    <div
                        style={{
                            width: 60,
                            height: 60,
                            background: "#f0f0f0",
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#999",
                            fontSize: 10,
                        }}
                    >
                        {t("No Image")}
                    </div>
                );
            },
        },
        {
            title: t("Name"),
            dataIndex: "name",
            key: "name",
            sorter: (a, b) => a.name.localeCompare(b.name),
            render: (name: string, record: CategoryRow) => (
                <div>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{name}</div>
                    <div style={{ fontSize: 12, color: "#999" }}>{record.slug}</div>
                </div>
            ),
        },
        {
            title: t("Sort Order"),
            dataIndex: "sort_order",
            key: "sort_order",
            sorter: (a, b) => a.sort_order - b.sort_order,
            width: 120,
        },
        {
            title: t("Featured"),
            dataIndex: "is_featured",
            key: "is_featured",
            width: 100,
            render: (is_featured: boolean) => (
                <Tag color={is_featured ? "gold" : "default"}>
                    {is_featured ? t("Yes") : t("No")}
                </Tag>
            ),
        },
        {
            title: t("Action"),
            key: "action",
            width: 120,
            render: (_: any, record: CategoryRow) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => router.push(`/admin/categories/${record.id}/edit`)}
                    >
                        {t("Edit")}
                    </Button>
                    {canDelete && (
                        <Popconfirm
                            title={t("Delete category")}
                            description={t("Are you sure you want to remove \"{name}\"?", { name: record.name })}
                            okText={t("Yes, delete")}
                            cancelText={t("Cancel")}
                            onConfirm={() => handleDelete(record)}
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
                        { title: t("Categories") },
                        { title: t("List") },
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
                            {t("Categories")}
                        </Title>
                        <Text type="secondary">
                            {t("Manage product categories and organization")}
                        </Text>
                    </div>
                    <Space>
                        {selectedRowKeys.length > 0 && canDelete && (
                                <Popconfirm
                                    title={t("Delete selected categories")}
                                    description={t("Are you sure you want to delete {count} categor(ies)?", { count: selectedRowKeys.length })}
                                    okText={t("Yes, delete")}
                                    cancelText={t("Cancel")}
                                    onConfirm={handleBulkDelete}
                                >
                                    <Button
                                        danger
                                        icon={<DeleteOutlined />}
                                        loading={bulkDeleting}
                                    >
                                        {t("Delete ({count})", { count: selectedRowKeys.length })}
                                    </Button>
                                </Popconfirm>
                        )}
                        <Button icon={<ReloadOutlined />} onClick={fetchCategories}>
                            {t("Refresh")}
                        </Button>
                        <Link href="/admin/categories/new">
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                size="large"
                                style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}
                            >
                                {t("Add Category")}
                            </Button>
                        </Link>
                    </Space>
                </div>
            </div>

            <Card>
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 12,
                        marginBottom: 16,
                    }}
                >
                    <Input
                        placeholder={t("Search categories...")}
                        prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        style={{ flex: "1 1 240px", minWidth: 200 }}
                    />
                </div>

                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={filteredCategories}
                    columns={columns}
                    rowSelection={{
                        selectedRowKeys,
                        onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys as string[]),
                        selections: [
                            Table.SELECTION_ALL,
                            Table.SELECTION_INVERT,
                            Table.SELECTION_NONE,
                        ],
                    }}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => t("{count} categories", { count: total }),
                    }}
                    locale={{
                        emptyText: (
                            <div style={{ padding: "40px 0", textAlign: "center" }}>
                                <div style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }}>📁</div>
                                <div style={{ color: "#999" }}>{t("No categories found")}</div>
                            </div>
                        ),
                    }}
                />
            </Card>
        </div>
    );
}

