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
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
    DeleteOutlined,
    EyeOutlined,
    SearchOutlined,
    ReloadOutlined,
} from "@ant-design/icons";

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
}

export default function AdminOrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [loading, setLoading] = useState(false);
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
                message.error(`Failed to load orders: ${response.status}`);
                return;
            }

            const result = await response.json();
            if (result.success) {
                setOrders(result.data || []);
            } else {
                message.error(result.error || "Unable to load orders");
            }
        } catch (error: any) {
            console.error("Fetch error:", error);
            message.error(`Failed to fetch orders: ${error.message || "Unknown error"}`);
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
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleDelete = async (order: OrderRow) => {
        try {
            const response = await fetch(`/api/orders?id=${order.id}`, {
                method: "DELETE",
            });

            const result = await response.json();
            if (result.success) {
                message.success(`Deleted order ${order.order_number}`);
                fetchOrders();
            } else {
                message.error(result.error || "Unable to delete order");
            }
        } catch (error: any) {
            console.error("Delete error:", error);
            message.error(`Failed to delete order: ${error.message || "Unknown error"}`);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning("No orders selected");
            return;
        }

        setBulkDeleting(true);
        try {
            const deletePromises = selectedRowKeys.map(id =>
                fetch(`/api/orders?id=${id}`, { method: "DELETE" })
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
                message.success(`Successfully deleted ${successCount} order${successCount > 1 ? 's' : ''}`);
            }
            if (failCount > 0) {
                message.error(`Failed to delete ${failCount} order${failCount > 1 ? 's' : ''}`);
            }

            setSelectedRowKeys([]);
            fetchOrders();
        } catch (error: any) {
            console.error("Bulk delete error:", error);
            message.error(`Failed to delete orders: ${error.message || "Unknown error"}`);
        } finally {
            setBulkDeleting(false);
        }
    };

    const columns: ColumnsType<OrderRow> = [
        {
            title: "Order #",
            dataIndex: "order_number",
            key: "order_number",
            sorter: (a, b) => a.order_number.localeCompare(b.order_number),
            render: (orderNumber: string) => (
                <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{orderNumber}</span>
            ),
        },
        {
            title: "Customer",
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
            title: "Total",
            dataIndex: "total",
            key: "total",
            sorter: (a, b) => a.total - b.total,
            render: (total: number) => formatPrice(total),
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            sorter: (a, b) => a.status.localeCompare(b.status),
            render: (status: string) => {
                const colorMap: Record<string, string> = {
                    pending: "orange",
                    processing: "blue",
                    shipped: "cyan",
                    delivered: "green",
                    cancelled: "red",
                };
                return (
                    <Tag color={colorMap[status] || "default"}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Tag>
                );
            },
        },
        {
            title: "Payment",
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
                        {paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
                    </Tag>
                );
            },
        },
        {
            title: "Date",
            dataIndex: "created_at",
            key: "created_at",
            sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            render: (date: string) => formatDate(date),
        },
        {
            title: "Action",
            key: "action",
            width: 120,
            render: (_: any, record: OrderRow) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => router.push(`/admin/orders/${record.id}`)}
                    >
                        View
                    </Button>
                    <Popconfirm
                        title="Delete order"
                        description={`Are you sure you want to delete order ${record.order_number}?`}
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
                        { title: "Orders" },
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
                            Orders
                        </Title>
                        <Text type="secondary">
                            Manage customer orders and fulfillment
                        </Text>
                    </div>
                    <Space>
                        {selectedRowKeys.length > 0 && (
                            <Popconfirm
                                title="Delete selected orders"
                                description={`Are you sure you want to delete ${selectedRowKeys.length} order${selectedRowKeys.length > 1 ? 's' : ''}?`}
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
                        <Button icon={<ReloadOutlined />} onClick={fetchOrders}>
                            Refresh
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
                            { value: "all", label: "All statuses" },
                            { value: "pending", label: "Pending" },
                            { value: "processing", label: "Processing" },
                            { value: "shipped", label: "Shipped" },
                            { value: "delivered", label: "Delivered" },
                            { value: "cancelled", label: "Cancelled" },
                        ]}
                        style={{ width: 160 }}
                    />
                    <Select
                        value={paymentStatusFilter}
                        onChange={(value) => setPaymentStatusFilter(value)}
                        options={[
                            { value: "all", label: "All payments" },
                            { value: "pending", label: "Pending" },
                            { value: "paid", label: "Paid" },
                            { value: "failed", label: "Failed" },
                            { value: "refunded", label: "Refunded" },
                        ]}
                        style={{ width: 160 }}
                    />
                    <Input
                        placeholder="Search orders..."
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
                        showTotal: (total) => `Total ${total} orders`,
                    }}
                    locale={{
                        emptyText: (
                            <div style={{ padding: "40px 0", textAlign: "center" }}>
                                <div style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }}>📦</div>
                                <div style={{ color: "#999" }}>No orders found</div>
                            </div>
                        ),
                    }}
                />
            </Card>
        </div>
    );
}

