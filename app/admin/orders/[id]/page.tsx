"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    Button,
    Card,
    Breadcrumb,
    message,
    Typography,
    Space,
    Spin,
    Descriptions,
    Table, Select,
    Divider
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
    ArrowLeftOutlined,
    SaveOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

interface OrderItem {
    id: string;
    product_name: string;
    quantity: number;
    price: number;
    subtotal: number;
    product_image?: string;
}

interface Order {
    id: string;
    order_number: string;
    customer_first_name: string;
    customer_last_name: string;
    customer_email: string;
    customer_phone: string;
    shipping_address?: string;
    shipping_city?: string;
    shipping_state?: string;
    shipping_zip?: string;
    shipping_country?: string;
    subtotal: number;
    shipping_cost: number;
    total: number;
    order_notes?: string;
    status: string;
    payment_status: string;
    created_at: string;
    items: OrderItem[];
}

export default function OrderDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [status, setStatus] = useState<string>("");
    const [paymentStatus, setPaymentStatus] = useState<string>("");

    useEffect(() => {
        if (!id) return;

        const fetchOrder = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/orders?id=${id}`);
                const result = await response.json();

                if (result.success && result.data) {
                    setOrder(result.data);
                    setStatus(result.data.status);
                    setPaymentStatus(result.data.payment_status);
                } else {
                    message.error("Order not found");
                    router.push("/admin/orders");
                }
            } catch (error) {
                console.error("Error fetching order:", error);
                message.error("Failed to load order details");
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
    }, [id, router]);

    const handleUpdateStatus = async () => {
        if (!order) return;

        setUpdating(true);
        try {
            const response = await fetch("/api/orders", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id: order.id,
                    status,
                    payment_status: paymentStatus,
                }),
            });

            const result = await response.json();

            if (result.success) {
                message.success("Order updated successfully!");
                setOrder({ ...order, status, payment_status: paymentStatus });
            } else {
                message.error(result.error || "Failed to update order");
            }
        } catch (error: any) {
            console.error("Error updating order:", error);
            message.error(error.message || "Failed to update order");
        } finally {
            setUpdating(false);
        }
    };

    const formatPrice = (price: number) => {
        return `${price.toFixed(3)} DT`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const itemColumns: ColumnsType<OrderItem> = [
        {
            title: "Product",
            dataIndex: "product_name",
            key: "product_name",
        },
        {
            title: "Quantity",
            dataIndex: "quantity",
            key: "quantity",
            width: 100,
        },
        {
            title: "Price",
            dataIndex: "price",
            key: "price",
            width: 120,
            render: (price: number) => formatPrice(price),
        },
        {
            title: "Subtotal",
            dataIndex: "subtotal",
            key: "subtotal",
            width: 120,
            render: (subtotal: number) => formatPrice(subtotal),
        },
    ];

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
                <Spin size="large" tip="Loading order details...">
                    <div style={{ padding: "50px" }} />
                </Spin>
            </div>
        );
    }

    if (!order) {
        return null;
    }

    return (
        <div style={{ padding: 24, background: "#fff", minHeight: "100vh" }}>
            <Breadcrumb
                items={[
                    { title: <Link href="/admin/dashboard">Dashboard</Link> },
                    { title: <Link href="/admin/orders">Orders</Link> },
                    { title: order.order_number },
                ]}
            />

            <div style={{ marginTop: 24, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <Title level={2} style={{ margin: 0, fontWeight: 600 }}>
                        Order {order.order_number}
                    </Title>
                    <Text type="secondary">
                        Placed on {formatDate(order.created_at)}
                    </Text>
                </div>
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => router.push("/admin/orders")}
                >
                    Back to Orders
                </Button>
            </div>

            <Space orientation="vertical" size="large" style={{ width: "100%" }}>
                {/* Status Update Card */}
                <Card title="Order Status">
                    <Space orientation="vertical" style={{ width: "100%" }} size="middle">
                        <div>
                            <Text strong style={{ display: "block", marginBottom: 8 }}>Order Status</Text>
                            <Select
                                value={status}
                                onChange={setStatus}
                                style={{ width: 200 }}
                                options={[
                                    { value: "pending", label: "Pending" },
                                    { value: "processing", label: "Processing" },
                                    { value: "shipped", label: "Shipped" },
                                    { value: "delivered", label: "Delivered" },
                                    { value: "cancelled", label: "Cancelled" },
                                ]}
                            />
                        </div>
                        <div>
                            <Text strong style={{ display: "block", marginBottom: 8 }}>Payment Status</Text>
                            <Select
                                value={paymentStatus}
                                onChange={setPaymentStatus}
                                style={{ width: 200 }}
                                options={[
                                    { value: "pending", label: "Pending" },
                                    { value: "paid", label: "Paid" },
                                    { value: "failed", label: "Failed" },
                                    { value: "refunded", label: "Refunded" },
                                ]}
                            />
                        </div>
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={handleUpdateStatus}
                            loading={updating}
                            disabled={status === order.status && paymentStatus === order.payment_status}
                            style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}
                        >
                            Update Status
                        </Button>
                    </Space>
                </Card>

                {/* Customer Information */}
                <Card title="Customer Information">
                    <Descriptions column={2}>
                        <Descriptions.Item label="Name">
                            {order.customer_first_name} {order.customer_last_name}
                        </Descriptions.Item>
                        <Descriptions.Item label="Email">{order.customer_email}</Descriptions.Item>
                        <Descriptions.Item label="Phone">{order.customer_phone || "—"}</Descriptions.Item>
                    </Descriptions>
                </Card>

                {/* Shipping Information */}
                {(order.shipping_address || order.shipping_city) && (
                    <Card title="Shipping Address">
                        <Descriptions column={1}>
                            <Descriptions.Item label="Address">{order.shipping_address || "—"}</Descriptions.Item>
                            <Descriptions.Item label="City">{order.shipping_city || "—"}</Descriptions.Item>
                            <Descriptions.Item label="State/Province">{order.shipping_state || "—"}</Descriptions.Item>
                            <Descriptions.Item label="ZIP/Postal Code">{order.shipping_zip || "—"}</Descriptions.Item>
                            <Descriptions.Item label="Country">{order.shipping_country || "—"}</Descriptions.Item>
                        </Descriptions>
                    </Card>
                )}

                {/* Order Items */}
                <Card title="Order Items">
                    <Table
                        rowKey="id"
                        dataSource={order.items}
                        columns={itemColumns}
                        pagination={false}
                    />
                    <Divider />
                    <div style={{ textAlign: "right" }}>
                        <Space orientation="vertical" size="small">
                            <div>
                                <Text>Subtotal: </Text>
                                <Text strong>{formatPrice(order.subtotal)}</Text>
                            </div>
                            <div>
                                <Text>Shipping: </Text>
                                <Text strong>{formatPrice(order.shipping_cost)}</Text>
                            </div>
                            <div style={{ fontSize: 18 }}>
                                <Text strong>Total: </Text>
                                <Text strong style={{ color: "#7a3b2e" }}>{formatPrice(order.total)}</Text>
                            </div>
                        </Space>
                    </div>
                </Card>

                {/* Order Notes */}
                {order.order_notes && (
                    <Card title="Order Notes">
                        <Text>{order.order_notes}</Text>
                    </Card>
                )}
            </Space>
        </div>
    );
}

