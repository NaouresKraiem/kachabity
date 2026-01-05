"use client";

import { useState, useEffect } from "react";
import {
    Table,
    Button,
    Space,
    Card,
    Typography,
    Tag,
    message,
    Modal,
    Form,
    Select,
    InputNumber,
    DatePicker,
    Switch,
    Popconfirm,
} from "antd";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    PercentageOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface Product {
    id: string;
    name: string;
    base_price: number;
}

interface Promotion {
    id: string;
    product_id: string;
    discount_percent: number;
    starts_at?: string | null;
    ends_at?: string | null;
    active: boolean;
    created_at?: string;
    products?: Product;
}

export default function PromotionsPage() {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
    const [form] = Form.useForm();

    // Fetch promotions
    const fetchPromotions = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/promotions");
            const result = await response.json();
            if (result.success) {
                setPromotions(result.data || []);
            } else {
                message.error("Failed to load promotions");
            }
        } catch (error) {
            console.error("Error fetching promotions:", error);
            message.error("Failed to load promotions");
        } finally {
            setLoading(false);
        }
    };

    // Fetch products
    const fetchProducts = async () => {
        try {
            const response = await fetch("/api/products?admin=true");
            const result = await response.json();
            if (result.success) {
                setProducts(result.data || []);
            }
        } catch (error) {
            console.error("Error fetching products:", error);
        }
    };

    useEffect(() => {
        fetchPromotions();
        fetchProducts();
    }, []);

    // Open modal for create/edit
    const openModal = (promotion?: Promotion) => {
        if (promotion) {
            setEditingPromotion(promotion);
            form.setFieldsValue({
                product_id: promotion.product_id,
                discount_percent: promotion.discount_percent,
                date_range: promotion.starts_at && promotion.ends_at
                    ? [dayjs(promotion.starts_at), dayjs(promotion.ends_at)]
                    : null,
                active: promotion.active,
            });
        } else {
            setEditingPromotion(null);
            form.resetFields();
            form.setFieldsValue({ active: true });
        }
        setModalVisible(true);
    };

    // Close modal
    const closeModal = () => {
        setModalVisible(false);
        setEditingPromotion(null);
        form.resetFields();
    };

    // Save promotion
    const handleSave = async (values: any) => {
        try {
            const payload = {
                product_id: values.product_id,
                discount_percent: values.discount_percent,
                starts_at: values.date_range ? values.date_range[0].toISOString() : null,
                ends_at: values.date_range ? values.date_range[1].toISOString() : null,
                active: values.active !== false,
            };

            const url = editingPromotion
                ? "/api/promotions"
                : "/api/promotions";

            const response = await fetch(url, {
                method: editingPromotion ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingPromotion ? { ...payload, id: editingPromotion.id } : payload),
            });

            const result = await response.json();

            if (result.success) {
                message.success(editingPromotion ? "Promotion updated!" : "Promotion created!");
                closeModal();
                fetchPromotions();
            } else {
                message.error(result.error || "Failed to save promotion");
            }
        } catch (error) {
            console.error("Error saving promotion:", error);
            message.error("Failed to save promotion");
        }
    };

    // Delete promotion
    const handleDelete = async (id: string) => {
        try {
            const response = await fetch("/api/promotions", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });

            const result = await response.json();

            if (result.success) {
                message.success("Promotion deleted!");
                fetchPromotions();
            } else {
                message.error(result.error || "Failed to delete promotion");
            }
        } catch (error) {
            console.error("Error deleting promotion:", error);
            message.error("Failed to delete promotion");
        }
    };

    // Table columns
    const columns = [
        {
            title: "Product",
            dataIndex: ["products", "name"],
            key: "product",
            render: (name: string, record: Promotion) => name || `Product #${record.product_id.slice(0, 8)}`,
        },
        {
            title: "Discount",
            dataIndex: "discount_percent",
            key: "discount",
            render: (percent: number) => (
                <Tag icon={<PercentageOutlined />} color="red">
                    {percent}% OFF
                </Tag>
            ),
        },
        {
            title: "Start Date",
            dataIndex: "starts_at",
            key: "starts_at",
            render: (date: string) => date ? dayjs(date).format("MMM DD, YYYY") : <span style={{ color: "#999" }}>Immediate</span>,
        },
        {
            title: "End Date",
            dataIndex: "ends_at",
            key: "ends_at",
            render: (date: string) => date ? dayjs(date).format("MMM DD, YYYY") : <span style={{ color: "#999" }}>No End Date</span>,
        },
        {
            title: "Status",
            dataIndex: "active",
            key: "active",
            render: (active: boolean, record: Promotion) => {
                const now = new Date();
                const isExpired = record.ends_at && new Date(record.ends_at) < now;
                const notStarted = record.starts_at && new Date(record.starts_at) > now;
                const isIndefinite = !record.ends_at && !record.starts_at;

                if (isExpired) return <Tag color="default">Expired</Tag>;
                if (notStarted) return <Tag color="blue">Scheduled</Tag>;
                if (active && isIndefinite) return <Tag color="purple">Active (Ongoing)</Tag>;
                if (active && !record.ends_at) return <Tag color="purple">Active (No End Date)</Tag>;
                if (active) return <Tag color="green">Active</Tag>;
                return <Tag color="red">Inactive</Tag>;
            },
        },
        {
            title: "Actions",
            key: "actions",
            render: (_: any, record: Promotion) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => openModal(record)}
                    >
                        Edit
                    </Button>
                    <Popconfirm
                        title="Delete promotion?"
                        description="This action cannot be undone."
                        onConfirm={() => handleDelete(record.id)}
                        okText="Delete"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                    >
                        <Button type="text" danger icon={<DeleteOutlined />}>
                            Delete
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <Title level={2} style={{ margin: 0 }}>
                        Promotions & Discounts
                    </Title>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => openModal()}
                        size="large"
                        style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}
                    >
                        Create Promotion
                    </Button>
                </div>

                <Table
                    columns={columns}
                    dataSource={promotions}
                    loading={loading}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            {/* Create/Edit Modal */}
            <Modal
                title={editingPromotion ? "Edit Promotion" : "Create Promotion"}
                open={modalVisible}
                onCancel={closeModal}
                onOk={() => form.submit()}
                okText="Save"
                cancelText="Cancel"
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                    initialValues={{ active: true }}
                >
                    <Form.Item
                        label="Product"
                        name="product_id"
                        rules={[{ required: true, message: "Please select a product" }]}
                    >
                        <Select
                            placeholder="Select product"
                            showSearch
                            optionFilterProp="children"
                            size="large"
                        >
                            {products.map((product) => (
                                <Option key={product.id} value={product.id}>
                                    {product.name} ({product.base_price} DT)
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="Discount Percentage"
                        name="discount_percent"
                        rules={[
                            { required: true, message: "Please enter discount percentage" },
                            {
                                validator: (_, value) => {
                                    if (!value) return Promise.reject("Please enter discount percentage");
                                    if (value < 1 || value > 100) return Promise.reject("Must be between 1-100%");
                                    return Promise.resolve();
                                }
                            },
                        ]}
                    >
                        <Space.Compact style={{ width: "100%" }}>
                            <InputNumber
                                style={{ width: "100%" }}
                                placeholder="e.g., 20"
                                min={1}
                                max={100}
                                size="large"
                            />
                            <span style={{ padding: "8px 16px", border: "1px solid #d9d9d9", borderLeft: "none", display: "flex", alignItems: "center" }}>%</span>
                        </Space.Compact>
                    </Form.Item>

                    <Form.Item
                        label="Duration (Optional)"
                        name="date_range"
                        help="Leave empty for promotions that run indefinitely"
                    >
                        <RangePicker
                            style={{ width: "100%" }}
                            size="large"
                            showTime
                            format="YYYY-MM-DD HH:mm"
                            placeholder={["Start Date (Optional)", "End Date (Optional)"]}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Active"
                        name="active"
                        valuePropName="checked"
                    >
                        <Switch />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

