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
    Select,
    Table,
    Tag,
    Typography,
    Space,
    Image,
    Badge,
    Tooltip,
} from "antd";
import { message } from "@/components/admin/antd-app";
import { ORDER_ITEM_IMAGE_FALLBACK, ORDER_STATUS_COLORS, ORDER_STATUS_OPTIONS, orderStatusLabel, validateOrder } from "@/components/admin/order-status";
import { useAdminRole } from "@/lib/admin-role-context";
import type { ColumnsType } from "antd/es/table";
import {
    DeleteOutlined,
    EyeOutlined,
    SearchOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import { DATE_LOCALES, useAdminT } from "@/lib/admin-i18n";

const { Title, Text } = Typography;

interface OrderRow {
    id: string;
    order_number: string;
    customer_first_name: string;
    customer_last_name: string;
    customer_email: string;
    customer_phone: string;
    total: number;
    status: string;
    payment_status: string;
    created_at: string;
    items?: { id: string; product_name: string; product_image: string | null; quantity: number; variant_label: string | null }[];
}

export default function AdminOrdersPage() {
    const { t, locale } = useAdminT();
    const canDelete = useAdminRole().can("delete");
    const router = useRouter();
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [loading, setLoading] = useState(true); // first fetch starts on mount: show the table spinner right away
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const [bulkDeleting, setBulkDeleting] = useState(false);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'all') {
                params.append('status', statusFilter);
            }

            const response = await fetch(`/api/orders?${params.toString()}`);

            if (!response.ok) {
                const text = await response.text();
                console.error("API Error:", response.status, text);
                message.error(t("Failed to load orders: {status}", { status: response.status }));
                return;
            }

            const result = await response.json();
            if (result.success) {
                setOrders(result.data || []);
            } else {
                message.error(result.error || t("Unable to load orders"));
            }
        } catch (error: any) {
            console.error("Fetch error:", error);
            message.error(t("Failed to fetch orders: {error}", { error: error.message || t("Unknown error") }));
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const filteredOrders = useMemo(() => {
        return orders.filter((order) => {
            const matchesSearch =
                order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.customer_first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.customer_last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.customer_email.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesPaymentStatus =
                paymentStatusFilter === "all" ? true : order.payment_status === paymentStatusFilter;

            return matchesSearch && matchesPaymentStatus;
        });
    }, [orders, searchTerm, paymentStatusFilter]);

    const formatPrice = (price: number) => {
        return `${price.toFixed(3)} DT`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString(DATE_LOCALES[locale], {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const [validatingId, setValidatingId] = useState<string | null>(null);
    const handleValidate = async (order: OrderRow) => {
        setValidatingId(order.id);
        try {
            await validateOrder(order.id);
            message.success(t("Order {order_number} validated", { order_number: order.order_number }));
            fetchOrders();
        } catch (e) {
            message.error(t((e as Error).message));
        } finally {
            setValidatingId(null);
        }
    };

    const handleDelete = async (order: OrderRow) => {
        try {
            const response = await fetch(`/api/orders?id=${order.id}`, {
                method: "DELETE",
            });

            const result = await response.json();
            if (result.success) {
                message.success(t("Deleted order {order_number}", { order_number: order.order_number }));
                fetchOrders();
            } else {
                message.error(result.error || t("Unable to delete order"));
            }
        } catch (error: any) {
            console.error("Delete error:", error);
            message.error(t("Failed to delete order: {error}", { error: error.message || t("Unknown error") }));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning(t("No orders selected"));
            return;
        }

        setBulkDeleting(true);
        try {
            // One request: the server deletes all selected orders in a single transaction, or none.
            const response = await fetch(`/api/orders?ids=${selectedRowKeys.join(",")}`, { method: "DELETE" });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) {
                throw new Error(result?.error || "Delete failed");
            }
            const successCount = selectedRowKeys.length;
            const failCount = 0;

            if (successCount > 0) {
                message.success(t("Successfully deleted {count} order(s)", { count: successCount }));
            }
            if (failCount > 0) {
                message.error(t("Failed to delete {count} order(s)", { count: failCount }));
            }

            setSelectedRowKeys([]);
            fetchOrders();
        } catch (error: any) {
            console.error("Bulk delete error:", error);
            message.error(t("Failed to delete orders: {error}", { error: error.message || t("Unknown error") }));
        } finally {
            setBulkDeleting(false);
        }
    };

    const columns: ColumnsType<OrderRow> = [
        {
            title: t("Order #"),
            dataIndex: "order_number",
            key: "order_number",
            sorter: (a, b) => a.order_number.localeCompare(b.order_number),
            render: (orderNumber: string) => (
                <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{orderNumber}</span>
            ),
        },
        {
            title: t("Customer"),
            key: "customer",
            render: (_: any, record: OrderRow) => (
                <div>
                    <div style={{ fontWeight: 500 }}>
                        {record.customer_first_name} {record.customer_last_name}
                    </div>
                    <div style={{ fontSize: 12, color: "#999" }}>{record.customer_email}</div>
                </div>
            ),
        },
        {
            title: t("Products"),
            key: "items",
            render: (_: any, record: OrderRow) => {
                const items = record.items ?? [];
                const shown = items.slice(0, 3);
                return (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap" }}>
                        {shown.map((item) => (
                            <Tooltip key={item.id} title={`${item.quantity} × ${item.product_name}${item.variant_label ? ` (${item.variant_label})` : ""}`}>
                                <Badge count={item.quantity > 1 ? item.quantity : 0} size="small" color="#7a3b2e">
                                    <Image
                                        src={item.product_image || undefined}
                                        alt={item.product_name}
                                        width={40}
                                        height={40}
                                        preview={false}
                                        fallback={ORDER_ITEM_IMAGE_FALLBACK}
                                        style={{ objectFit: "cover", objectPosition: "top", borderRadius: 6, border: "1px solid #f0f0f0" }}
                                    />
                                </Badge>
                            </Tooltip>
                        ))}
                        {items.length > shown.length && <Text type="secondary">+{items.length - shown.length}</Text>}
                    </div>
                );
            },
        },
        {
            title: t("Total"),
            dataIndex: "total",
            key: "total",
            sorter: (a, b) => a.total - b.total,
            render: (total: number) => formatPrice(total),
        },
        {
            title: t("Status"),
            dataIndex: "status",
            key: "status",
            sorter: (a, b) => a.status.localeCompare(b.status),
            render: (status: string) => <Tag color={ORDER_STATUS_COLORS[status] || "default"}>{t(orderStatusLabel(status))}</Tag>,
        },
        {
            title: t("Payment"),
            dataIndex: "payment_status",
            key: "payment_status",
            sorter: (a, b) => a.payment_status.localeCompare(b.payment_status),
            render: (paymentStatus: string) => {
                const colorMap: Record<string, string> = {
                    pending: "orange",
                    paid: "green",
                    failed: "red",
                    refunded: "purple",
                };
                return (
                    <Tag color={colorMap[paymentStatus] || "default"}>
                        {t(paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1))}
                    </Tag>
                );
            },
        },
        {
            title: t("Date"),
            dataIndex: "created_at",
            key: "created_at",
            sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            render: (date: string) => formatDate(date),
        },
        {
            title: t("Action"),
            key: "action",
            width: 220,
            render: (_: any, record: OrderRow) => (
                <Space>
                    {record.status === "pending" && (
                        <Popconfirm
                            title={t("Validate order {order_number}?", { order_number: record.order_number })}
                            description={t("This confirms the order and takes its items out of stock.")}
                            okText={t("Validate")}
                            onConfirm={() => handleValidate(record)}
                        >
                            <Button type="primary" size="small" loading={validatingId === record.id} onClick={(e) => e.stopPropagation()}>
                                {t("Validate")}
                            </Button>
                        </Popconfirm>
                    )}
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => router.push(`/admin/orders/${record.id}`)}
                    >
                        {t("View")}
                    </Button>
                    {canDelete && (
                        <Popconfirm
                            title={t("Delete order")}
                            description={t("Are you sure you want to delete order {order_number}?", { order_number: record.order_number })}
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
                        { title: t("Orders") },
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
                            {t("Orders")}
                        </Title>
                        <Text type="secondary">
                            {t("Manage customer orders and fulfillment")}
                        </Text>
                    </div>
                    <Space>
                        {selectedRowKeys.length > 0 && canDelete && (
                                <Popconfirm
                                    title={t("Delete selected orders")}
                                    description={t("Are you sure you want to delete {count} order(s)?", { count: selectedRowKeys.length })}
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
                        <Button icon={<ReloadOutlined />} onClick={fetchOrders}>
                            {t("Refresh")}
                        </Button>
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
                            { value: "all", label: t("All statuses") },
                            ...ORDER_STATUS_OPTIONS.map((o) => ({ ...o, label: t(o.label) })),
                        ]}
                        style={{ width: 160 }}
                    />
                    <Select
                        value={paymentStatusFilter}
                        onChange={(value) => setPaymentStatusFilter(value)}
                        options={[
                            { value: "all", label: t("All payments") },
                            { value: "pending", label: t("Pending") },
                            { value: "paid", label: t("Paid") },
                            { value: "failed", label: t("Failed") },
                            { value: "refunded", label: t("Refunded") },
                        ]}
                        style={{ width: 160 }}
                    />
                    <Input
                        placeholder={t("Search orders...")}
                        prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        style={{ flex: "1 1 240px", minWidth: 200 }}
                    />
                </div>

                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={filteredOrders}
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
                        showTotal: (total) => t("{count} orders", { count: total }),
                    }}
                    locale={{
                        emptyText: (
                            <div style={{ padding: "40px 0", textAlign: "center" }}>
                                <div style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }}>📦</div>
                                <div style={{ color: "#999" }}>{t("No orders found")}</div>
                            </div>
                        ),
                    }}
                />
            </Card>
        </div>
    );
}

