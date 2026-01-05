"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Button,
    Card,
    Breadcrumb,
    Input,
    message,
    Popconfirm,
    Table,
    Tag,
    Typography,
    Space,
    Image,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
    DeleteOutlined,
    PlusOutlined,
    EditOutlined,
    SearchOutlined,
    ReloadOutlined,
} from "@ant-design/icons";

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
    const router = useRouter();
    const [categories, setCategories] = useState<CategoryRow[]>([]);
    const [loading, setLoading] = useState(false);
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
                message.error(`Failed to load categories: ${response.status}`);
                return;
            }

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                console.error("Expected JSON but got:", contentType, text.substring(0, 100));
                message.error("Server returned invalid response");
                return;
            }

            const result = await response.json();
            if (result.success) {
                setCategories(result.data || []);
            } else {
                message.error(result.error || "Unable to load categories");
            }
        } catch (error: any) {
            console.error("Fetch error:", error);
            message.error(`Failed to fetch categories: ${error.message || "Unknown error"}`);
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
                message.error(`Failed to delete: ${response.status}`);
                return;
            }

            const result = await response.json();
            if (result.success) {
                message.success(`Deleted ${category.name}`);
                fetchCategories();
            } else {
                message.error(result.error || "Unable to delete category");
            }
        } catch (error: any) {
            console.error("Delete error:", error);
            message.error(`Failed to delete category: ${error.message || "Unknown error"}`);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning("No categories selected");
            return;
        }

        setBulkDeleting(true);
        try {
            const deletePromises = selectedRowKeys.map(id =>
                fetch(`/api/categories?id=${id}`, { method: "DELETE" })
            );

            const results = await Promise.all(deletePromises);

            let successCount = 0;
            let failCount = 0;

            for (const response of results) {
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } else {
                    failCount++;
                }
            }

            if (successCount > 0) {
                message.success(`Successfully deleted ${successCount} categor${successCount > 1 ? 'ies' : 'y'}`);
            }
            if (failCount > 0) {
                message.error(`Failed to delete ${failCount} categor${failCount > 1 ? 'ies' : 'y'}`);
            }

            setSelectedRowKeys([]);
            fetchCategories();
        } catch (error: any) {
            console.error("Bulk delete error:", error);
            message.error(`Failed to delete categories: ${error.message || "Unknown error"}`);
        } finally {
            setBulkDeleting(false);
        }
    };

    const columns: ColumnsType<CategoryRow> = [
        {
            title: "Image",
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
                        No Image
                    </div>
                );
            },
        },
        {
            title: "Name",
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
            title: "Sort Order",
            dataIndex: "sort_order",
            key: "sort_order",
            sorter: (a, b) => a.sort_order - b.sort_order,
            width: 120,
        },
        {
            title: "Featured",
            dataIndex: "is_featured",
            key: "is_featured",
            width: 100,
            render: (is_featured: boolean) => (
                <Tag color={is_featured ? "gold" : "default"}>
                    {is_featured ? "Yes" : "No"}
                </Tag>
            ),
        },
        {
            title: "Action",
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
                        Edit
                    </Button>
                    <Popconfirm
                        title="Delete category"
                        description={`Are you sure you want to remove "${record.name}"?`}
                        okText="Yes, delete"
                        cancelText="Cancel"
                        onConfirm={() => handleDelete(record)}
                    >
                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                            Delete
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
                <Breadcrumb
                    items={[
                        { title: <Link href="/admin/dashboard">Dashboard</Link> },
                        { title: "Categories" },
                        { title: "List" },
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
                            Categories
                        </Title>
                        <Text type="secondary">
                            Manage product categories and organization
                        </Text>
                    </div>
                    <Space>
                        {selectedRowKeys.length > 0 && (
                            <Popconfirm
                                title="Delete selected categories"
                                description={`Are you sure you want to delete ${selectedRowKeys.length} categor${selectedRowKeys.length > 1 ? 'ies' : 'y'}?`}
                                okText="Yes, delete"
                                cancelText="Cancel"
                                onConfirm={handleBulkDelete}
                            >
                                <Button
                                    danger
                                    icon={<DeleteOutlined />}
                                    loading={bulkDeleting}
                                >
                                    Delete ({selectedRowKeys.length})
                                </Button>
                            </Popconfirm>
                        )}
                        <Button icon={<ReloadOutlined />} onClick={fetchCategories}>
                            Refresh
                        </Button>
                        <Link href="/admin/categories/new">
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                size="large"
                                style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}
                            >
                                Add Category
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
                        placeholder="Search categories..."
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
                        showTotal: (total) => `Total ${total} categories`,
                    }}
                    locale={{
                        emptyText: (
                            <div style={{ padding: "40px 0", textAlign: "center" }}>
                                <div style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }}>📁</div>
                                <div style={{ color: "#999" }}>No categories found</div>
                            </div>
                        ),
                    }}
                />
            </Card>
        </div>
    );
}

