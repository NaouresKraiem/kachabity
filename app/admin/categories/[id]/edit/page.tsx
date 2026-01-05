"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    Form,
    Input,
    Button,
    InputNumber,
    Switch,
    message,
    Card,
    Breadcrumb,
    Typography,
    Space,
    Row,
    Col,
    Spin,
    Upload,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import {
    SaveOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

export default function EditCategoryPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [imageFile, setImageFile] = useState<UploadFile[]>([]);

    // Fetch category data
    useEffect(() => {
        if (!id) return;

        const fetchCategory = async () => {
            setFetching(true);
            try {
                const response = await fetch("/api/categories");
                const result = await response.json();

                if (result.success && result.data) {
                    const category = result.data.find((c: any) => c.id === id);

                    if (category) {
                        form.setFieldsValue({
                            name: category.name,
                            slug: category.slug,
                            sort_order: category.sort_order,
                            is_featured: category.is_featured,
                        });

                        // Set image if exists
                        if (category.image_url) {
                            setImageFile([{
                                uid: '-1',
                                name: 'image',
                                status: 'done',
                                url: category.image_url,
                            }]);
                        }
                    } else {
                        message.error("Category not found");
                        router.push("/admin/categories");
                    }
                } else {
                    message.error("Category not found");
                    router.push("/admin/categories");
                }
            } catch (error) {
                console.error("Error fetching category:", error);
                message.error("Failed to load category details");
            } finally {
                setFetching(false);
            }
        };

        fetchCategory();
    }, [id, form, router]);

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
            // Upload new image if provided, or keep existing
            let imageUrl = null;
            if (imageFile.length > 0) {
                if (imageFile[0].originFileObj) {
                    // New image uploaded
                    imageUrl = await handleImageUpload(imageFile[0].originFileObj);
                } else if (imageFile[0].url) {
                    // Existing image kept
                    imageUrl = imageFile[0].url;
                }
            }

            const categoryData = {
                id,
                name: values.name,
                slug: values.slug,
                sort_order: values.sort_order || 0,
                is_featured: values.is_featured || false,
                image_url: imageUrl,
            };

            const response = await fetch("/api/categories", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(categoryData),
            });

            const result = await response.json();

            if (result.success) {
                message.success("Category updated successfully!");
                router.push("/admin/categories");
            } else {
                message.error(result.error || "Failed to update category");
            }
        } catch (error: any) {
            console.error("Error updating category:", error);
            message.error(error.message || "Failed to update category");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Spin size="large" tip="Loading category details..." spinning={fetching}>
            <div style={{ padding: 24, background: "#fff", minHeight: "100vh" }}>
                <Breadcrumb
                    items={[
                        { title: <Link href="/admin/dashboard">Dashboard</Link> },
                        { title: <Link href="/admin/categories">Categories</Link> },
                        { title: "Edit" },
                    ]}
                />

                <div style={{ marginTop: 24, marginBottom: 24 }}>
                    <Title level={2} style={{ margin: 0, fontWeight: 600 }}>
                        Edit Category
                    </Title>
                    <Text type="secondary">
                        Update category details
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
                                    label="Category Name"
                                    name="name"
                                    rules={[
                                        { required: true, message: "Please enter category name" },
                                    ]}
                                >
                                    <Input placeholder="Enter category name" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    label="Slug"
                                    name="slug"
                                    tooltip="URL-friendly identifier"
                                >
                                    <Input placeholder="category-slug" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item label="Category Image">
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
                                        <div style={{ marginTop: 8 }}>Upload</div>
                                    </div>
                                )}
                            </Upload>
                            <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                                Upload a category image (optional)
                            </Text>
                        </Form.Item>

                        <Row gutter={16}>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    label="Sort Order"
                                    name="sort_order"
                                    tooltip="Lower numbers appear first"
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
                                    label="Featured Category"
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
                                    Update Category
                                </Button>
                                <Button
                                    icon={<ArrowLeftOutlined />}
                                    onClick={() => router.push("/admin/categories")}
                                >
                                    Cancel
                                </Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Card>
            </div>
        </Spin>
    );
}

