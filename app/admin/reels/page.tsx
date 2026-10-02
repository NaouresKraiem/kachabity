"use client";

import { useState, useEffect } from "react";
import {
    Table,
    Button,
    Space,
    Card,
    Typography,
    Tag,
    Modal,
    Form,
    Input,
    InputNumber,
    Switch,
    Upload,
    Popconfirm,
} from "antd";
import { message } from "@/components/admin/antd-app";
import { useAdminRole } from "@/lib/admin-role-context";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    UploadOutlined,
    PlayCircleOutlined,
} from "@ant-design/icons";
import type { UploadFile } from "antd";
import { useAdminT } from "@/lib/admin-i18n";

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
    const { t } = useAdminT();
    const canDelete = useAdminRole().can("delete");
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
                message.error(t("Failed to load reels"));
            }
        } catch (error) {
            console.error("Error fetching reels:", error);
            message.error(t("Failed to load reels"));
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
                message.error(t("Please upload a thumbnail"));
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
                message.success(editingReel ? t("Reel updated!") : t("Reel created!"));
                closeModal();
                fetchReels();
            } else {
                message.error(result.error || t("Failed to save reel"));
            }
        } catch (error) {
            console.error("Error saving reel:", error);
            message.error(t("Failed to save reel"));
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
                message.success(t("Reel deleted!"));
                fetchReels();
            } else {
                message.error(result.error || t("Failed to delete reel"));
            }
        } catch (error) {
            console.error("Error deleting reel:", error);
            message.error(t("Failed to delete reel"));
        }
    };

    // Table columns
    const columns = [
        {
            title: t("Preview"),
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
            title: t("Title"),
            dataIndex: "title",
            key: "title",
        },
        {
            title: t("Username"),
            dataIndex: "username",
            key: "username",
            render: (username: string) => <Text type="secondary">{username}</Text>,
        },
        {
            title: t("Description"),
            dataIndex: "description",
            key: "description",
            render: (text: string) => text || "—",
        },
        {
            title: t("Order"),
            dataIndex: "sort_order",
            key: "sort_order",
            width: 80,
        },
        {
            title: t("Status"),
            dataIndex: "active",
            key: "active",
            render: (active: boolean) => (
                <Tag color={active ? "green" : "red"}>
                    {active ? t("Active") : t("Inactive")}
                </Tag>
            ),
        },
        {
            title: t("Badge"),
            dataIndex: "is_new",
            key: "is_new",
            render: (is_new: boolean) => (
                is_new ? <Tag color="gold">{t("✨ NEW")}</Tag> : "—"
            ),
        },
        {
            title: t("Actions"),
            key: "actions",
            render: (_: any, record: Reel) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => openModal(record)}
                    >
                        {t("Edit")}
                    </Button>
                    {canDelete && (
                        <Popconfirm
                            title={t("Delete reel?")}
                            description={t("This action cannot be undone.")}
                            onConfirm={() => handleDelete(record.id)}
                            okText={t("Delete")}
                            cancelText={t("Cancel")}
                            okButtonProps={{ danger: true }}
                        >
                            <Button type="text" danger icon={<DeleteOutlined />}>
                                {t("Delete")}
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <Title level={2} style={{ margin: 0 }}>
                        {t("Video Reels")}
                    </Title>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => openModal()}
                        size="large"
                        style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}
                    >
                        {t("Create Reel")}
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
                title={editingReel ? t("Edit Reel") : t("Create Reel")}
                open={modalVisible}
                onCancel={closeModal}
                onOk={() => form.submit()}
                okText={t("Save")}
                cancelText={t("Cancel")}
                width={700}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                    initialValues={{ active: true, sort_order: 0, username: '@kachabiti', is_new: false }}
                >
                    <Form.Item
                        label={t("Thumbnail Image")}
                        required
                        help={t("Upload a thumbnail for the video (9:16 ratio recommended)")}
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
                                    <div style={{ marginTop: 8 }}>{t("Upload Thumbnail")}</div>
                                </div>
                            )}
                        </Upload>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {t("Recommended: 1080x1920px (9:16 vertical)")}
                        </Text>
                    </Form.Item>

                    <Form.Item
                        label={t("Video URL")}
                        name="video_url"
                        rules={[{ required: true, message: t("Please enter video URL") }]}
                        help={t("Paste YouTube, Instagram, TikTok, or Facebook video link")}
                    >
                        <Input
                            placeholder={t("e.g., https://www.youtube.com/watch?v=xxxxx or https://www.instagram.com/reel/xxxxx")}
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label={t("Title")}
                        name="title"
                        rules={[{ required: true, message: t("Please enter title") }]}
                    >
                        <Input
                            placeholder={t("e.g., منتجات جديدة or عروض حصرية")}
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label={t("Description")}
                        name="description"
                    >
                        <TextArea
                            placeholder={t("e.g., تعرف على أحدث منتجاتنا 🔥")}
                            rows={3}
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label={t("Username")}
                        name="username"
                    >
                        <Input
                            placeholder={t("@kachabiti")}
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label={t("Sort Order")}
                        name="sort_order"
                        help={t("Lower numbers appear first")}
                    >
                        <InputNumber
                            style={{ width: "100%" }}
                            placeholder="0"
                            min={0}
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        label={t("Active")}
                        name="active"
                        valuePropName="checked"
                    >
                        <Switch />
                    </Form.Item>

                    <Form.Item
                        label={t("Show 'NEW' Badge")}
                        name="is_new"
                        valuePropName="checked"
                        help={t("Display \u2728 NEW badge on this video")}
                    >
                        <Switch />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

