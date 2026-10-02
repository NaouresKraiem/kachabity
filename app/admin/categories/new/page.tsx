"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Form,
    Input,
    Button,
    InputNumber,
    Switch,
    Card,
    Breadcrumb,
    Typography,
    Space,
    Row,
    Col,
    Upload,
} from "antd";
import { message } from "@/components/admin/antd-app";
import type { UploadFile } from "antd/es/upload/interface";
import CategoryExtraFields from "@/components/admin/CategoryExtraFields";
import {
    SaveOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import { useAdminT } from "@/lib/admin-i18n";

const { Title, Text } = Typography;

export default function CreateCategoryPage() {
    const { t } = useAdminT();
    const router = useRouter();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [imageFile, setImageFile] = useState<UploadFile[]>([]);

    const handleImageUpload = async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload/image", {
            method: "POST",
            body: formData,
        });

        const result = await response.json();
        if (result.success) {
            return result.url;
        }
        throw new Error(result.error || "Upload failed");
    };

    const handleSubmit = async (values: any) => {
        setLoading(true);
        try {
            // Upload image if provided
            let imageUrl = null;
            if (imageFile.length > 0 && imageFile[0].originFileObj) {
                imageUrl = await handleImageUpload(imageFile[0].originFileObj);
            }

            const categoryData = {
                name: values.name,
                slug: values.slug || null,
                sort_order: values.sort_order || 0,
                is_featured: values.is_featured || false,
                image_url: imageUrl,
                name_ar: values.name_ar || null,
                name_fr: values.name_fr || null,
                parent_id: values.parent_id || null,
            };

            const response = await fetch("/api/categories", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(categoryData),
            });

            const result = await response.json();

            if (result.success) {
                message.success(t("Category created successfully!"));
                router.push("/admin/categories");
            } else {
                message.error(result.error || t("Failed to create category"));
            }
        } catch (error: any) {
            console.error("Error creating category:", error);
            message.error(error.message || t("Failed to create category"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: 24, background: "#fff", minHeight: "100vh" }}>
            <Breadcrumb
                items={[
                    { title: <Link href="/admin/dashboard">{t("Dashboard")}</Link> },
                    { title: <Link href="/admin/categories">{t("Categories")}</Link> },
                    { title: t("Create") },
                ]}
            />

            <div style={{ marginTop: 24, marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0, fontWeight: 600 }}>
                    {t("Create New Category")}
                </Title>
                <Text type="secondary">
                    {t("Add a new category to organize your products")}
                </Text>
            </div>

            <Card>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{
                        sort_order: 0,
                        is_featured: false,
                    }}
                >
                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label={t("Category Name")}
                                name="name"
                                rules={[
                                    { required: true, message: t("Please enter category name") },
                                ]}
                            >
                                <Input placeholder={t("Enter category name")} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label={t("Slug")}
                                name="slug"
                                tooltip={t("URL-friendly identifier (auto-generated from name if left empty)")}
                            >
                                <Input placeholder="category-slug" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <CategoryExtraFields />

                    <Form.Item label={t("Category Image")}>
                        <Upload
                            listType="picture-card"
                            fileList={imageFile}
                            onChange={({ fileList }) => setImageFile(fileList.slice(-1))}
                            beforeUpload={() => false}
                            maxCount={1}
                        >
                            {imageFile.length === 0 && (
                                <div>
                                    <PlusOutlined />
                                    <div style={{ marginTop: 8 }}>{t("Upload")}</div>
                                </div>
                            )}
                        </Upload>
                        <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                            {t("Upload a category image (optional)")}
                        </Text>
                    </Form.Item>

                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label={t("Sort Order")}
                                name="sort_order"
                                tooltip={t("Lower numbers appear first")}
                            >
                                <InputNumber
                                    style={{ width: "100%" }}
                                    placeholder="0"
                                    min={0}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label={t("Featured Category")}
                                name="is_featured"
                                valuePropName="checked"
                            >
                                <Switch />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item>
                        <Space>
                            <Button
                                type="primary"
                                htmlType="submit"
                                icon={<SaveOutlined />}
                                loading={loading}
                                size="large"
                                style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}
                            >
                                {t("Create Category")}
                            </Button>
                            <Button
                                icon={<ArrowLeftOutlined />}
                                onClick={() => router.push("/admin/categories")}
                            >
                                {t("Cancel")}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
}

