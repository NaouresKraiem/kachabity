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
    Input,
    InputNumber,
    DatePicker,
    Switch,
    Upload,
    Popconfirm,
} from "antd";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    UploadOutlined,
    PercentageOutlined,
} from "@ant-design/icons";
import type { UploadFile } from "antd";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface SaleBanner {
    id: string;
    title: string;
    subtitle?: string | null;
    badge_text?: string | null;
    discount_percent: number;
    image_url: string;
    starts_at?: string | null;
    ends_at?: string | null;
    active: boolean;
    created_at?: string;
}

export default function SaleBannersPage() {
    const [banners, setBanners] = useState<SaleBanner[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingBanner, setEditingBanner] = useState<SaleBanner | null>(null);
    const [imageFile, setImageFile] = useState<UploadFile[]>([]);
    const [form] = Form.useForm();

    // Fetch banners
    const fetchBanners = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/sale-banners");
            const result = await response.json();
            if (result.success) {
                setBanners(result.data || []);
            } else {
                message.error("Failed to load sale banners");
            }
        } catch (error) {
            console.error("Error fetching banners:", error);
            message.error("Failed to load sale banners");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBanners();
    }, []);

    // Upload image
    const handleImageUpload = async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload/image", {
            method: "POST",
            body: formData,
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || "Image upload failed");
        }

        return result.url;
    };

    // Open modal for create/edit
    const openModal = (banner?: SaleBanner) => {
        if (banner) {
            setEditingBanner(banner);
            form.setFieldsValue({
                title: banner.title,
                subtitle: banner.subtitle,
                badge_text: banner.badge_text,
                discount_percent: banner.discount_percent,
                date_range: banner.starts_at && banner.ends_at
                    ? [dayjs(banner.starts_at), dayjs(banner.ends_at)]
                    : null,
                active: banner.active,
            });
            // Show existing image
            setImageFile([{
                uid: '-1',
                name: 'current-image',
                status: 'done',
                url: banner.image_url,
            }]);
        } else {
            setEditingBanner(null);
            form.resetFields();
            form.setFieldsValue({ active: true, discount_percent: 0 });
            setImageFile([]);
        }
        setModalVisible(true);
    };

    // Close modal
    const closeModal = () => {
        setModalVisible(false);
        setEditingBanner(null);
        form.resetFields();
        setImageFile([]);
    };

    // Save banner
    const handleSave = async (values: any) => {
        try {
            // Upload image if a new one was selected
            let imageUrl = editingBanner?.image_url || '';

            if (imageFile.length > 0 && imageFile[0].originFileObj) {
                imageUrl = await handleImageUpload(imageFile[0].originFileObj as File);
            } else if (!editingBanner && imageFile.length === 0) {
                message.error("Please upload an image");
                return;
            }

            const payload = {
                title: values.title,
                subtitle: values.subtitle || null,
                badge_text: values.badge_text || null,
                discount_percent: values.discount_percent || 0,
                image_url: imageUrl,
                starts_at: values.date_range ? values.date_range[0].toISOString() : null,
                ends_at: values.date_range ? values.date_range[1].toISOString() : null,
                active: values.active !== false,
            };

            const url = "/api/sale-banners";
            const response = await fetch(url, {
                method: editingBanner ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingBanner ? { ...payload, id: editingBanner.id } : payload),
            });

            const result = await response.json();

            if (result.success) {
                message.success(editingBanner ? "Banner updated!" : "Banner created!");
                closeModal();
                fetchBanners();
            } else {
                message.error(result.error || "Failed to save banner");
            }
        } catch (error) {
            console.error("Error saving banner:", error);
            message.error("Failed to save banner");
        }
    };

    // Delete banner
    const handleDelete = async (id: string) => {
        try {
            const response = await fetch("/api/sale-banners", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });

            const result = await response.json();

            if (result.success) {
                message.success("Banner deleted!");
                fetchBanners();
            } else {
                message.error(result.error || "Failed to delete banner");
            }
        } catch (error) {
            console.error("Error deleting banner:", error);
            message.error("Failed to delete banner");
        }
    };

    // Table columns
    const columns = [
        {
            title: "Banner",
            key: "preview",
            width: 120,
            render: (_: any, record: SaleBanner) => (
                <img
                    src={record.image_url}
                    alt={record.title}
                    style={{ width: 100, height: 60, objectFit: 'cover', borderRadius: 8 }}
                />
            ),
        },
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
        },
        {
            title: "Subtitle",
            dataIndex: "subtitle",
            key: "subtitle",
            render: (text: string) => text || "—",
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
            title: "Badge Text",
            dataIndex: "badge_text",
            key: "badge_text",
            render: (text: string) => text || "—",
        },
        {
            title: "Duration",
            key: "duration",
            render: (_: any, record: SaleBanner) => {
                if (!record.starts_at && !record.ends_at) {
                    return <span style={{ color: '#999' }}>Indefinite</span>;
                }
                return (
                    <div>
                        <div>{record.starts_at ? dayjs(record.starts_at).format("MMM DD, YYYY") : <span style={{ color: '#999' }}>Immediate</span>}</div>
                        <div style={{ color: '#999' }}>
                            to {record.ends_at ? dayjs(record.ends_at).format("MMM DD, YYYY") : 'No End Date'}
                        </div>
                    </div>
                );
            },
        },
        {
            title: "Status",
            dataIndex: "active",
            key: "active",
            render: (active: boolean, record: SaleBanner) => {
                const now = new Date();
                const isExpired = record.ends_at && new Date(record.ends_at) < now;
                const notStarted = record.starts_at && new Date(record.starts_at) > now;
                const isIndefinite = !record.ends_at && !record.starts_at;

                if (isExpired) return <Tag color="default">Expired</Tag>;
                if (notStarted) return <Tag color="blue">Scheduled</Tag>;
                if (active && isIndefinite) return <Tag color="purple">Active (Ongoing)</Tag>;
                if (active && !record.ends_at) return <Tag color="purple">Active (No End)</Tag>;
                if (active) return <Tag color="green">Active</Tag>;
                return <Tag color="red">Inactive</Tag>;
            },
        },
        {
            title: "Actions",
            key: "actions",
            render: (_: any, record: SaleBanner) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => openModal(record)}
                    >
                        Edit
                    </Button>
                    <Popconfirm
                        title="Delete banner?"
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
                        Sale Banners
                    </Title>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => openModal()}
                        size="large"
                        style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}
                    >
                        Create Banner
                    </Button>
                </div>

                <Table
                    columns={columns}
                    dataSource={banners}
                    loading={loading}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            {/* Create/Edit Modal */}
            <Modal
                title={editingBanner ? "Edit Sale Banner" : "Create Sale Banner"}
                open={modalVisible}
                onCancel={closeModal}
                onOk={() => form.submit()}
                okText="Save"
                cancelText="Cancel"
                width={700}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                    initialValues={{ active: true, discount_percent: 0 }}
                >
                    <Form.Item
                        label="Banner Image"
                        required
                        help="Upload the main banner image"
                    >
                        <Upload
                            listType="picture-card"
                            fileList={imageFile}
                            onChange={({ fileList }) => setImageFile(fileList.slice(-1))}
                            beforeUpload={() => false}
                            maxCount={1}
                        >
                            {imageFile.length === 0 && (
                                <div>
                                    <UploadOutlined />
                                    <div style={{ marginTop: 8 }}>Upload Image</div>
                                </div>
                            )}
                        </Upload>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Recommended: 1280x720px (16:9 aspect ratio)
                        </Text>
                    </Form.Item>

                    <Form.Item
                        label="Banner Title"
                        name="title"
                        rules={[{ required: true, message: "Please enter banner title" }]}
                        help="Main title for the banner"
                    >
                        <Input
                            placeholder="e.g., Summer Sale or خصم كبير"
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Subtitle"
                        name="subtitle"
                        help="Brief description or additional text"
                    >
                        <TextArea
                            placeholder="e.g., Get up to 50% off on selected items"
                            rows={2}
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Badge Text (Optional)"
                        name="badge_text"
                        help="Optional badge to highlight the offer (e.g., HOT, LIMITED)"
                    >
                        <Input
                            placeholder="e.g., عرض حصري or LIMITED OFFER"
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Discount Percentage"
                        name="discount_percent"
                        rules={[
                            {
                                validator: (_, value) => {
                                    if (value < 0 || value > 100) return Promise.reject("Must be between 0-100%");
                                    return Promise.resolve();
                                }
                            },
                        ]}
                    >
                        <Space.Compact style={{ width: "100%" }}>
                            <InputNumber
                                style={{ width: "100%" }}
                                placeholder="e.g., 50"
                                min={0}
                                max={100}
                                size="large"
                            />
                            <span style={{ padding: "8px 16px", border: "1px solid #d9d9d9", borderLeft: "none", display: "flex", alignItems: "center" }}>%</span>
                        </Space.Compact>
                    </Form.Item>

                    <Form.Item
                        label="Sale Duration (Optional)"
                        name="date_range"
                        help="Set start and end dates for time-limited sales. Leave empty for permanent banners."
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

