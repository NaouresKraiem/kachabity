"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Form,
    Input,
    Button,
    Select,
    InputNumber, Upload,
    message,
    Card,
    Breadcrumb,
    Typography,
    Space,
    Divider,
    Row,
    Col
} from "antd";
import {
    SaveOutlined,
    ArrowLeftOutlined,
    PlusOutlined
} from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface Category {
    id: string;
    name: string;
}

interface Size {
    id: string;
    name: string;
    display_name?: string;
}

interface Color {
    id: string;
    name: string;
    hex_code?: string;
    display_name?: string;
}

interface Variant {
    size_id?: string;
    color_id?: string;
    sku?: string;
    price?: number;
    stock: number;
    is_available: boolean;
    is_active?: boolean; // Legacy
    images?: UploadFile[]; // Variant-specific images
}

export default function CreateProductPage() {
    const router = useRouter();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [sizes, setSizes] = useState<Size[]>([]);
    const [colors, setColors] = useState<Color[]>([]);
    const [imageFiles, setImageFiles] = useState<UploadFile[]>([]);
    const [variants, setVariants] = useState<Variant[]>([]);

    // For quick add
    const [quickColorId, setQuickColorId] = useState<string | undefined>(undefined);
    const [quickSizeIds, setQuickSizeIds] = useState<string[]>([]);

    // Fetch categories
    useEffect(() => {
        async function fetchCategories() {
            try {
                const response = await fetch("/api/categories");
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Categories API error:", response.status, errorText);
                    if (response.status === 401) {
                        message.error("Unauthorized. Please log in as admin.");
                    } else {
                        message.warning(`Failed to load categories (${response.status}). Please refresh.`);
                    }
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
                    const categoriesData = result.data || [];
                    setCategories(categoriesData);
                    if (categoriesData.length === 0) {
                        message.warning("No categories available. Please create categories first.");
                    }
                } else {
                    console.error("Failed to fetch categories:", result.error);
                    message.warning(result.error || "Failed to load categories. Please refresh the page.");
                }
            } catch (error: any) {
                console.error("Failed to fetch categories", error);
                message.error(`Failed to load categories: ${error.message || "Please check your connection."}`);
            }
        }
        fetchCategories();
    }, []);

    // Fetch sizes
    useEffect(() => {
        async function fetchSizes() {
            try {
                const response = await fetch("/api/sizes");
                const result = await response.json();
                if (result.success) {
                    setSizes(result.data || []);
                }
            } catch (error) {
                console.error("Failed to fetch sizes", error);
            }
        }
        fetchSizes();
    }, []);

    // Fetch colors
    useEffect(() => {
        async function fetchColors() {
            try {
                const response = await fetch("/api/colors");
                const result = await response.json();
                if (result.success) {
                    setColors(result.data || []);
                }
            } catch (error) {
                console.error("Failed to fetch colors", error);
            }
        }
        fetchColors();
    }, []);

    // Handle image upload
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

    // Handle form submission
    const handleSubmit = async (values: any) => {
        setLoading(true);
        try {
            // Upload product-level images first
            const productImageUrls: string[] = [];
            for (const file of imageFiles) {
                if (file.originFileObj) {
                    const url = await handleImageUpload(file.originFileObj);
                    productImageUrls.push(url);
                } else if (file.url) {
                    productImageUrls.push(file.url);
                }
            }

            // Auto-generate variants from color and sizes
            let variantsToCreate = variants;

            // Get stock quantity from form (default to 0 if not provided)
            const stockQuantity = parseInt(values.stock_quantity) || 0;

            if (values.color_id && values.size_ids && values.size_ids.length > 0) {
                // Create variants automatically for each size with the selected color
                variantsToCreate = values.size_ids.map((sizeId: string) => ({
                    color_id: values.color_id,
                    size_id: sizeId,
                    sku: '',
                    price: undefined,
                    stock: stockQuantity,
                    is_available: true,
                    images: [],
                }));
            } else if (values.color_id) {
                // Only color, no sizes
                variantsToCreate = [{
                    color_id: values.color_id,
                    size_id: undefined,
                    sku: '',
                    price: undefined,
                    stock: stockQuantity,
                    is_available: true,
                    images: [],
                }];
            }

            // Prepare product data
            const productData = {
                name: values.name,
                slug: values.slug,
                description: values.description || null,
                category_id: values.category_id || null,
                base_price: parseFloat(values.base_price),
                status: values.status || "active",
                images: productImageUrls.map((url, index) => ({
                    url,
                    is_main: index === 0,
                    position: index,
                })),
                variants: await Promise.all(
                    variantsToCreate.map(async (variant) => {
                        // Upload variant-specific images
                        const variantImageUrls: string[] = [];
                        if (variant.images && variant.images.length > 0) {
                            for (const file of variant.images) {
                                if (file.originFileObj) {
                                    const url = await handleImageUpload(file.originFileObj);
                                    variantImageUrls.push(url);
                                } else if (file.url) {
                                    variantImageUrls.push(file.url);
                                }
                            }
                        }

                        return {
                            size_id: variant.size_id || null,
                            color_id: variant.color_id || null,
                            sku: variant.sku || null,
                            price: variant.price || null,
                            stock: variant.stock || 0,
                            is_available: variant.is_available !== false,
                            // Support legacy is_active
                            is_active: variant.is_available !== false,
                            images: variantImageUrls.map((url, index) => ({
                                url,
                                is_main: index === 0,
                                position: index,
                            })),
                        };
                    })
                ),
            };

            const response = await fetch("/api/products", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(productData),
            });

            const result = await response.json();

            if (result.success) {
                message.success("Product created successfully!");
                router.push("/admin/products");
            } else {
                message.error(result.error || "Failed to create product");
            }
        } catch (error: any) {
            console.error("Error creating product:", error);
            message.error(error.message || "Failed to create product");
        } finally {
            setLoading(false);
        }
    };

    // Add variant
    const addVariant = () => {
        setVariants([
            ...variants,
            {
                size_id: undefined,
                color_id: undefined,
                sku: "",
                price: undefined,
                stock: 0,
                is_available: true,
                images: [],
            },
        ]);
    };

    // Remove variant
    const removeVariant = (index: number) => {
        setVariants(variants.filter((_, i) => i !== index));
    };

    // Update variant
    const updateVariant = (index: number, field: keyof Variant, value: any) => {
        const updated = [...variants];
        updated[index] = { ...updated[index], [field]: value };
        setVariants(updated);
    };

    // Quick add variants with one color and multiple sizes
    const quickAddVariants = () => {
        if (!quickColorId && quickSizeIds.length === 0) {
            message.warning('Please select a color or at least one size');
            return;
        }

        const newVariants: Variant[] = [];

        if (quickSizeIds.length > 0) {
            // Create variant for each selected size
            for (const sizeId of quickSizeIds) {
                const exists = variants.some(v =>
                    v.color_id === quickColorId && v.size_id === sizeId
                );
                if (!exists) {
                    newVariants.push({
                        color_id: quickColorId,
                        size_id: sizeId,
                        sku: '',
                        price: undefined,
                        stock: 0,
                        is_available: true,
                        images: [],
                    });
                }
            }
        } else if (quickColorId) {
            // Only color, no sizes
            const exists = variants.some(v => v.color_id === quickColorId && !v.size_id);
            if (!exists) {
                newVariants.push({
                    color_id: quickColorId,
                    size_id: undefined,
                    sku: '',
                    price: undefined,
                    stock: 0,
                    is_available: true,
                    images: [],
                });
            }
        }

        if (newVariants.length > 0) {
            setVariants([...variants, ...newVariants]);
            message.success(`Added ${newVariants.length} variant(s)`);
            // Clear selections
            setQuickColorId(undefined);
            setQuickSizeIds([]);
        } else {
            message.info('Selected combinations already exist');
        }
    };

    return (
        <div style={{ padding: 24, background: "#fff", minHeight: "100vh" }}>
            <Breadcrumb
                items={[
                    { title: <Link href="/admin/dashboard">Dashboard</Link> },
                    { title: <Link href="/admin/products">Products</Link> },
                    { title: "Create" },
                ]}
            />

            <div style={{ marginTop: 24, marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0, fontWeight: 600 }}>
                    Create New Product
                </Title>
                <Text type="secondary">
                    Add a new product to your catalog
                </Text>
            </div>

            <Card>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{
                        status: "active",
                    }}
                >
                    {/* Basic Information */}
                    <Title level={4}>Basic Information</Title>
                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Product Name"
                                name="name"
                                rules={[
                                    { required: true, message: "Please enter product name" },
                                ]}
                            >
                                <Input placeholder="Enter product name" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Slug"
                                name="slug"
                                tooltip="URL-friendly identifier (auto-generated from name if left empty)"
                            >
                                <Input placeholder="product-slug" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        label="Description"
                        name="description"
                    >
                        <TextArea
                            rows={4}
                            placeholder="Enter product description"
                        />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Category"
                                name="category_id"
                            >
                                <Select
                                    placeholder={categories.length === 0 ? "No categories available" : "Select category"}
                                    allowClear
                                    showSearch
                                    optionFilterProp="children"
                                    notFoundContent={categories.length === 0 ? "No categories found. Create categories first." : null}
                                    loading={categories.length === 0}
                                >
                                    {categories.map((cat) => (
                                        <Option key={cat.id} value={cat.id}>
                                            {cat.name}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                            {categories.length === 0 && (
                                <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                                    No categories available. Please create categories in the database first.
                                </Text>
                            )}
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Status"
                                name="status"
                            >
                                <Select>
                                    <Option value="active">Active</Option>
                                    <Option value="inactive">Inactive</Option>
                                    <Option value="archived">Archived</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider />

                    {/* Pricing */}
                    <Title level={4}>Pricing & Stock</Title>
                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Base Price"
                                name="base_price"
                                rules={[
                                    { required: true, message: "Please enter base price" },
                                    { type: "number", min: 0, message: "Price must be positive" },
                                ]}
                            >
                                <Space.Compact style={{ width: "100%" }}>
                                    <InputNumber
                                        style={{ width: "100%" }}
                                        placeholder="0.00"
                                        min={0}
                                        step={0.01}
                                        precision={2}
                                    />
                                    <Input
                                        style={{ width: 60 }}
                                        value="DT"
                                        disabled
                                    />
                                </Space.Compact>
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Stock Quantity (per size)"
                                name="stock_quantity"
                                initialValue={0}
                                rules={[
                                    { required: true, message: "Please enter stock quantity" },
                                    { type: "number", min: 0, message: "Stock must be positive" },
                                ]}
                            >
                                <InputNumber
                                    style={{ width: "100%" }}
                                    placeholder="0"
                                    min={0}
                                    step={1}
                                />
                            </Form.Item>
                            <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: -16 }}>
                                This quantity will be assigned to each size variant
                            </Text>
                        </Col>
                    </Row>

                    <Divider />

                    {/* Color and Sizes */}
                    <Title level={4}>Color & Sizes</Title>
                    <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
                        Select a color and sizes for this product. Variants will be created automatically.
                    </Text>
                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Product Color"
                                name="color_id"
                                rules={[{ required: true, message: "Please select a color" }]}
                            >
                                <Select
                                    placeholder="Select product color"
                                    size="large"
                                    optionLabelProp="label"
                                >
                                    {colors.map((color) => (
                                        <Option
                                            key={color.id}
                                            value={color.id}
                                            label={color.display_name || color.name}
                                        >
                                            <Space>
                                                {color.hex_code && (
                                                    <span
                                                        style={{
                                                            display: "inline-block",
                                                            width: 16,
                                                            height: 16,
                                                            backgroundColor: color.hex_code,
                                                            border: "1px solid #d9d9d9",
                                                            borderRadius: 3,
                                                        }}
                                                    />
                                                )}
                                                <span>{color.display_name || color.name}</span>
                                            </Space>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label="Available Sizes"
                                name="size_ids"
                                rules={[{ required: true, message: "Please select at least one size" }]}
                            >
                                <Select
                                    mode="multiple"
                                    placeholder="Select available sizes"
                                    size="large"
                                >
                                    {sizes.map((size) => (
                                        <Option key={size.id} value={size.id}>
                                            {size.display_name || size.name}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider />

                    {/* Images */}
                    <Title level={4}>Product Images</Title>
                    <Form.Item>
                        <Upload
                            listType="picture-card"
                            fileList={imageFiles}
                            onChange={({ fileList }) => setImageFiles(fileList)}
                            beforeUpload={() => false}
                            multiple
                        >
                            {imageFiles.length < 10 && (
                                <div>
                                    <PlusOutlined />
                                    <div style={{ marginTop: 8 }}>Upload</div>
                                </div>
                            )}
                        </Upload>
                        <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                            Upload up to 10 images. First image will be set as main.
                        </Text>
                    </Form.Item>

                    {/* Variants will be created automatically from color and sizes above */}

                    <Divider />

                    {/* Actions */}
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
                                Create Product
                            </Button>
                            <Button
                                icon={<ArrowLeftOutlined />}
                                onClick={() => router.push("/admin/products")}
                            >
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
}

