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
    Switch,
    Upload,
    Popconfirm,
} from "antd";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    UploadOutlined,
    PlayCircleOutlined,
} from "@ant-design/icons";
import type { UploadFile } from "antd";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Reel {
    id: string;
    title: string;
    description?: string | null;
    username: string;
    thumbnail_url: string;
    video_url: string;
    sort_order: number;
    active: boolean;
    is_new?: boolean;
    created_at?: string;
}

export default function ReelsPage() {
    const [reels, setReels] = useState<Reel[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingReel, setEditingReel] = useState<Reel | null>(null);
    const [thumbnailFile, setThumbnailFile] = useState<UploadFile[]>([]);
    const [form] = Form.useForm();

    // Fetch reels
    const fetchReels = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/reels");
            const result = await response.json();
            if (result.success) {
                setReels(result.data || []);
            } else {
                message.error("Failed to load reels");
            }
        } catch (error) {
            console.error("Error fetching reels:", error);
            message.error("Failed to load reels");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReels();
    }, []);

    // Upload file
    const handleFileUpload = async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload/image", {
            method: "POST",
            body: formData,
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || "File upload failed");
        }

        return result.url;
    };

    // Open modal for create/edit
    const openModal = (reel?: Reel) => {
        if (reel) {
            setEditingReel(reel);
            form.setFieldsValue({
                title: reel.title,
                description: reel.description,
                username: reel.username,
                video_url: reel.video_url,
                sort_order: reel.sort_order,
                active: reel.active,
                is_new: reel.is_new || false,
            });
            // Show existing thumbnail
            setThumbnailFile([{
                uid: '-1',
                name: 'current-thumbnail',
                status: 'done',
                url: reel.thumbnail_url,
            }]);
        } else {
            setEditingReel(null);
            form.resetFields();
            form.setFieldsValue({ active: true, sort_order: 0, username: '@kachabiti', is_new: false });
            setThumbnailFile([]);
        }
        setModalVisible(true);
    };

    // Close modal
    const closeModal = () => {
        setModalVisible(false);
        setEditingReel(null);
        form.resetFields();
        setThumbnailFile([]);
    };

    // Save reel
    const handleSave = async (values: any) => {
        try {
            let thumbnailUrl = editingReel?.thumbnail_url || '';

            // Upload thumbnail if new one selected
            if (thumbnailFile.length > 0 && thumbnailFile[0].originFileObj) {
                thumbnailUrl = await handleFileUpload(thumbnailFile[0].originFileObj as File);
            } else if (!editingReel && thumbnailFile.length === 0) {
                message.error("Please upload a thumbnail");
                return;
            }

            const payload = {
                title: values.title,
                description: values.description || null,
                username: values.username || '@kachabiti',
                thumbnail_url: thumbnailUrl,
                video_url: values.video_url,
                sort_order: values.sort_order || 0,
                active: values.active !== false,
                is_new: values.is_new || false,
            };

            const url = "/api/reels";
            const response = await fetch(url, {
                method: editingReel ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingReel ? { ...payload, id: editingReel.id } : payload),
            });

            const result = await response.json();

            if (result.success) {
                message.success(editingReel ? "Reel updated!" : "Reel created!");
                closeModal();
                fetchReels();
            } else {
                message.error(result.error || "Failed to save reel");
            }
        } catch (error) {
            console.error("Error saving reel:", error);
            message.error("Failed to save reel");
        }
    };

    // Delete reel
    const handleDelete = async (id: string) => {
        try {
            const response = await fetch("/api/reels", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });

            const result = await response.json();

            if (result.success) {
                message.success("Reel deleted!");
                fetchReels();
            } else {
                message.error(result.error || "Failed to delete reel");
            }
        } catch (error) {
            console.error("Error deleting reel:", error);
            message.error("Failed to delete reel");
        }
    };

    // Table columns
    const columns = [
        {
            title: "Preview",
            key: "preview",
            width: 100,
            render: (_: any, record: Reel) => (
                <div className="relative w-16 h-28 rounded-lg overflow-hidden">
                    <img
                        src={record.thumbnail_url}
                        alt={record.title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <PlayCircleOutlined className="text-white text-2xl" />
                    </div>
                </div>
            ),
        },
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
        },
        {
            title: "Username",
            dataIndex: "username",
            key: "username",
            render: (username: string) => <Text type="secondary">{username}</Text>,
        },
        {
            title: "Description",
            dataIndex: "description",
            key: "description",
            render: (text: string) => text || "—",
        },
        {
            title: "Order",
            dataIndex: "sort_order",
            key: "sort_order",
            width: 80,
        },
        {
            title: "Status",
            dataIndex: "active",
            key: "active",
            render: (active: boolean) => (
                <Tag color={active ? "green" : "red"}>
                    {active ? "Active" : "Inactive"}
                </Tag>
            ),
        },
        {
            title: "Badge",
            dataIndex: "is_new",
            key: "is_new",
            render: (is_new: boolean) => (
                is_new ? <Tag color="gold">✨ NEW</Tag> : "—"
            ),
        },
        {
            title: "Actions",
            key: "actions",
            render: (_: any, record: Reel) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => openModal(record)}
                    >
                        Edit
                    </Button>
                    <Popconfirm
                        title="Delete reel?"
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
                        Video Reels
                    </Title>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => openModal()}
                        size="large"
                        style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}
                    >
                        Create Reel
                    </Button>
                </div>

                <Table
                    columns={columns}
                    dataSource={reels}
                    loading={loading}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            {/* Create/Edit Modal */}
            <Modal
                title={editingReel ? "Edit Reel" : "Create Reel"}
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
                    initialValues={{ active: true, sort_order: 0, username: '@kachabiti', is_new: false }}
                >
                    <Form.Item
                        label="Thumbnail Image"
                        required
                        help="Upload a thumbnail for the video (9:16 ratio recommended)"
                    >
                        <Upload
                            listType="picture-card"
                            fileList={thumbnailFile}
                            onChange={({ fileList }) => setThumbnailFile(fileList.slice(-1))}
                            beforeUpload={() => false}
                            maxCount={1}
                            accept="image/*"
                        >
                            {thumbnailFile.length === 0 && (
                                <div>
                                    <UploadOutlined />
                                    <div style={{ marginTop: 8 }}>Upload Thumbnail</div>
                                </div>
                            )}
                        </Upload>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Recommended: 1080x1920px (9:16 vertical)
                        </Text>
                    </Form.Item>

                    <Form.Item
                        label="Video URL"
                        name="video_url"
                        rules={[{ required: true, message: "Please enter video URL" }]}
                        help="Paste YouTube, Instagram, TikTok, or Facebook video link"
                    >
                        <Input
                            placeholder="e.g., https://www.youtube.com/watch?v=xxxxx or https://www.instagram.com/reel/xxxxx"
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Title"
                        name="title"
                        rules={[{ required: true, message: "Please enter title" }]}
                    >
                        <Input
                            placeholder="e.g., منتجات جديدة or عروض حصرية"
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Description"
                        name="description"
                    >
                        <TextArea
                            placeholder="e.g., تعرف على أحدث منتجاتنا 🔥"
                            rows={3}
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Username"
                        name="username"
                    >
                        <Input
                            placeholder="@kachabiti"
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Sort Order"
                        name="sort_order"
                        help="Lower numbers appear first"
                    >
                        <InputNumber
                            style={{ width: "100%" }}
                            placeholder="0"
                            min={0}
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label="Active"
                        name="active"
                        valuePropName="checked"
                    >
                        <Switch />
                    </Form.Item>

                    <Form.Item
                        label="Show 'NEW' Badge"
                        name="is_new"
                        valuePropName="checked"
                        help="Display ✨ NEW badge on this video"
                    >
                        <Switch />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

