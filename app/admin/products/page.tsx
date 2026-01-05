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
    Select,
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

interface Category {
    id: string;
    name: string;
}

interface ProductVariant {
    id: string;
    color?: string | null;
    size?: string | null;
    sku?: string | null;
    price?: number | null; // Changed from price_cents
    stock: number;
    is_active: boolean;
}

interface ProductImage {
    id: string;
    product_id: string;
    variant_id?: string | null;
    image_url: string;
    alt_text?: string | null;
    is_main: boolean;
    position: number;
}

interface ProductRow {
    id: string;
    name: string; // Changed from title
    slug: string;
    description: string | null;
    category_id: string | null;
    base_price: number; // Changed from price_cents
    status: 'active' | 'inactive' | 'archived';
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
    categories?: { name: string } | null;
    product_variants?: ProductVariant[];
    product_images?: ProductImage[]; // Images from product_images table
}

export default function AdminProductsPage() {
    const router = useRouter();
    const [products, setProducts] = useState<ProductRow[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "archived">("all");
    const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const [bulkDeleting, setBulkDeleting] = useState(false);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            // Use ?admin=true to get all products (including inactive)
            const response = await fetch("/api/products?admin=true");

            // Check if response is OK and is JSON
            if (!response.ok) {
                const text = await response.text();
                console.error("API Error:", response.status, text);
                message.error(`Failed to load products: ${response.status}`);
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
                setProducts(result.data || []);
            } else {
                message.error(result.error || "Unable to load products");
            }
        } catch (error: any) {
            console.error("Fetch error:", error);
            message.error(`Failed to fetch products: ${error.message || "Unknown error"}`);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchCategories = useCallback(async () => {
        try {
            const response = await fetch("/api/categories");

            if (!response.ok) {
                console.error("Categories API Error:", response.status);
                return;
            }

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                console.error("Expected JSON but got:", contentType, text.substring(0, 100));
                return;
            }

            const result = await response.json();
            if (result.success) {
                setCategories(result.data || []);
            }
        } catch (error: any) {
            console.error("Failed to fetch categories", error);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, [fetchProducts, fetchCategories]);

    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            const matchesSearch =
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.slug.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus =
                statusFilter === "all" ? true : product.status === statusFilter;

            const matchesCategory = categoryFilter ? product.category_id === categoryFilter : true;

            // Exclude soft-deleted products
            const isActive = product.deleted_at === null;

            return matchesSearch && matchesStatus && matchesCategory && isActive;
        });
    }, [products, searchTerm, statusFilter, categoryFilter]);

    const formatPrice = (basePrice: number) => {
        try {
            return new Intl.NumberFormat("fr-TN", {
                style: "currency",
                currency: "TND",
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
            }).format(basePrice);
        } catch {
            return `${basePrice.toFixed(3)} TND`;
        }
    };

    const handleDelete = async (product: ProductRow) => {
        try {
            const response = await fetch(`/api/products?id=${product.id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const text = await response.text();
                console.error("Delete API Error:", response.status, text);
                message.error(`Failed to delete: ${response.status}`);
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
                message.success(`Deleted ${product.name}`);
                fetchProducts();
            } else {
                message.error(result.error || "Unable to delete product");
            }
        } catch (error: any) {
            console.error("Delete error:", error);
            message.error(`Failed to delete product: ${error.message || "Unknown error"}`);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning("No products selected");
            return;
        }

        setBulkDeleting(true);
        try {
            const deletePromises = selectedRowKeys.map(id =>
                fetch(`/api/products?id=${id}`, { method: "DELETE" })
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
                message.success(`Successfully deleted ${successCount} product${successCount > 1 ? 's' : ''}`);
            }
            if (failCount > 0) {
                message.error(`Failed to delete ${failCount} product${failCount > 1 ? 's' : ''}`);
            }

            setSelectedRowKeys([]);
            fetchProducts();
        } catch (error: any) {
            console.error("Bulk delete error:", error);
            message.error(`Failed to delete products: ${error.message || "Unknown error"}`);
        } finally {
            setBulkDeleting(false);
        }
    };

    // Helper function to get primary image URL
    const getPrimaryImage = (record: ProductRow): string | null => {
        if (record.product_images && record.product_images.length > 0) {
            // Try to find main image first
            const mainImage = record.product_images.find(img => img.is_main);
            if (mainImage) return mainImage.image_url;
            // Fallback to first image
            return record.product_images[0]?.image_url || null;
        }
        return null;
    };

    const columns: ColumnsType<ProductRow> = [
        {
            title: "Image",
            key: "image",
            width: 100,
            render: (_: any, record: ProductRow) => {
                const imageUrl = getPrimaryImage(record);
                return imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={record.product_images?.find(img => img.is_main)?.alt_text || record.name}
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
            title: "Product Name",
            dataIndex: "name",
            key: "name",
            sorter: (a, b) => a.name.localeCompare(b.name),
            render: (name: string, record: ProductRow) => (
                <div>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{name}</div>
                    <div style={{ fontSize: 12, color: "#999" }}>{record.slug}</div>
                </div>
            ),
        },
        {
            title: "Category",
            dataIndex: ["categories", "name"],
            key: "category",
            sorter: (a, b) => (a.categories?.name || "").localeCompare(b.categories?.name || ""),
            render: (_: any, record) => record.categories?.name || "—",
        },
        {
            title: "Base Price",
            dataIndex: "base_price",
            key: "base_price",
            sorter: (a, b) => a.base_price - b.base_price,
            render: (basePrice: number) => `${basePrice} DT`,
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            sorter: (a, b) => a.status.localeCompare(b.status),
            render: (status: string) => {
                const colorMap: Record<string, string> = {
                    active: "green",
                    inactive: "orange",
                    archived: "red",
                };
                return (
                    <Tag color={colorMap[status] || "default"}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Tag>
                );
            },
        },
        {
            title: "Variants",
            dataIndex: "product_variants",
            key: "variants",
            render: (variants: ProductVariant[] = []) => (
                <span>{variants.length} variant{variants.length !== 1 ? "s" : ""}</span>
            ),
        },
        {
            title: "Action",
            key: "action",
            width: 120,
            render: (_: any, record: ProductRow) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => router.push(`/admin/products/${record.id}/edit`)}
                    >
                        Edit
                    </Button>
                    <Popconfirm
                        title="Delete product"
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
                        { title: "Products" },
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
                            Product catalog
                        </Title>
                        <Text type="secondary">
                            Monitor stock levels and pricing across your entire inventory.
                        </Text>
                    </div>
                    <Space>
                        {selectedRowKeys.length > 0 && (
                            <Popconfirm
                                title="Delete selected products"
                                description={`Are you sure you want to delete ${selectedRowKeys.length} product${selectedRowKeys.length > 1 ? 's' : ''}?`}
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
                        <Button icon={<ReloadOutlined />} onClick={fetchProducts}>
                            Refresh
                        </Button>
                        <Link href="/admin/products/new">
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                size="large"
                                style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}
                            >
                                Add Product
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
                    <Select
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value)}
                        options={[
                            { value: "all", label: "All status" },
                            { value: "active", label: "Active" },
                            { value: "inactive", label: "Inactive" },
                            { value: "archived", label: "Archived" },
                        ]}
                        style={{ width: 160 }}
                    />
                    <Select
                        allowClear
                        placeholder="Category"
                        value={categoryFilter}
                        onChange={(value) => setCategoryFilter(value)}
                        options={categories.map((category) => ({
                            label: category.name,
                            value: category.id,
                        }))}
                        style={{ width: 200 }}
                    />
                    <Input
                        placeholder="Search products..."
                        prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        style={{ flex: "1 1 240px", minWidth: 200 }}
                    />
                </div>

                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={filteredProducts}
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
                        showTotal: (total) => `Total ${total} products`,
                    }}
                    locale={{
                        emptyText: (
                            <div style={{ padding: "40px 0", textAlign: "center" }}>
                                <div style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }}>📦</div>
                                <div style={{ color: "#999" }}>No products found</div>
                            </div>
                        ),
                    }}
                />
            </Card>
        </div>
    );
}
