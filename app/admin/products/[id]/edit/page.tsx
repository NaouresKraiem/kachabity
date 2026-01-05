"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    Form,
    Input,
    Button,
    Select,
    InputNumber,
    Switch,
    Upload,
    message,
    Card,
    Breadcrumb,
    Typography,
    Space,
    Divider,
    Row,
    Col,
    Spin,
} from "antd";
import {
    SaveOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
    DeleteOutlined
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
    images?: UploadFile[];
}

export default function EditProductPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [categories, setCategories] = useState<Category[]>([]);
    const [sizes, setSizes] = useState<Size[]>([]);
    const [colors, setColors] = useState<Color[]>([]);
    const [imageFiles, setImageFiles] = useState<UploadFile[]>([]);
    const [variants, setVariants] = useState<Variant[]>([]);

    // For quick add
    const [quickColorId, setQuickColorId] = useState<string | undefined>(undefined);
    const [quickSizeIds, setQuickSizeIds] = useState<string[]>([]);

    // Fetch categories, sizes, colors
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [catRes, sizeRes, colorRes] = await Promise.all([
                    fetch("/api/categories"),
                    fetch("/api/sizes"),
                    fetch("/api/colors")
                ]);

                const catData = await catRes.json();
                const sizeData = await sizeRes.json();
                const colorData = await colorRes.json();

                if (catData.success) setCategories(catData.data || []);
                if (sizeData.success) setSizes(sizeData.data || []);
                if (colorData.success) setColors(colorData.data || []);
            } catch (error) {
                console.error("Error fetching dependencies:", error);
                message.error("Failed to load some form data");
            }
        };
        fetchData();
    }, []);

    // Fetch product data
    useEffect(() => {
        if (!id) return;

        const fetchProduct = async () => {
            setFetching(true);
            try {
                // Use admin=true to bypass status check if needed, though we added ID support to GET
                const response = await fetch(`/api/products?id=${id}&admin=true`);
                const result = await response.json();

                if (result.success && result.data) {
                    const product = result.data;

                    // Populate form
                    form.setFieldsValue({
                        name: product.name,
                        slug: product.slug,
                        description: product.description,
                        category_id: product.category_id,
                        status: product.status,
                        base_price: product.base_price,
                    });

                    // Populate images
                    if (product.product_images && product.product_images.length > 0) {
                        const formattedImages: UploadFile[] = product.product_images.map((img: any) => ({
                            uid: img.id || `img-${Math.random()}`,
                            name: 'image',
                            status: 'done',
                            url: img.image_url,
                            // Store is_main and position if needed
                            is_main: img.is_main,
                            position: img.position
                        })).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

                        setImageFiles(formattedImages);
                    }

                    // Populate variants
                    if (product.product_variants && product.product_variants.length > 0) {
                        const formattedVariants = product.product_variants.map((v: any) => ({
                            size_id: v.size_id,
                            color_id: v.color_id,
                            sku: v.sku,
                            price: v.price, // Note: check if backend returns price or price_cents
                            stock: v.stock,
                            is_available: v.is_available !== false, // Default to true if undefined
                            images: v.images ? v.images.map((img: any, idx: number) => ({
                                uid: `var-img-${v.id}-${idx}`,
                                name: 'variant-image',
                                status: 'done',
                                url: typeof img === 'string' ? img : img.url
                            })) : []
                        }));
                        setVariants(formattedVariants);
                    }
                } else {
                    message.error("Product not found");
                    router.push("/admin/products");
                }
            } catch (error) {
                console.error("Error fetching product:", error);
                message.error("Failed to load product details");
            } finally {
                setFetching(false);
            }
        };

        fetchProduct();
    }, [id, form, router]);

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
            console.log('Submitting with image files:', imageFiles);

            // Upload/Collect product-level images
            const productImageUrls: string[] = [];
            for (const file of imageFiles) {
                if (file.originFileObj) {
                    console.log('Uploading new file:', file.name);
                    const url = await handleImageUpload(file.originFileObj);
                    productImageUrls.push(url);
                } else if (file.url) {
                    console.log('Using existing url:', file.url);
                    productImageUrls.push(file.url);
                } else {
                    console.warn('File has no URL or originFileObj:', file);
                }
            }

            console.log('Final product image URLs:', productImageUrls);

            // Prepare product data
            const productData = {
                id, // Include ID for update
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
                    variants.map(async (variant, variantIndex) => {
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
                method: "PUT", // Changed to PUT
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(productData),
            });

            const result = await response.json();

            if (result.success) {
                message.success("Product updated successfully!");
                router.push("/admin/products");
            } else {
                message.error(result.error || "Failed to update product");
            }
        } catch (error: any) {
            console.error("Error updating product:", error);
            message.error(error.message || "Failed to update product");
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
        <Spin size="large" tip="Loading product details..." spinning={fetching}>
            <div style={{ padding: 24, background: "#fff", minHeight: "100vh" }}>
                <Breadcrumb
                    items={[
                        { title: <Link href="/admin/dashboard">Dashboard</Link> },
                        { title: <Link href="/admin/products">Products</Link> },
                        { title: "Edit" },
                    ]}
                />

                <div style={{ marginTop: 24, marginBottom: 24 }}>
                    <Title level={2} style={{ margin: 0, fontWeight: 600 }}>
                        Edit Product
                    </Title>
                    <Text type="secondary">
                        Update product details and inventory
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
                                    tooltip="URL-friendly identifier"
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
                        <Title level={4}>Pricing</Title>
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
                                            placeholder="230"
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

                        <Divider />

                        {/* Quick Add Variants */}
                        <Card
                            style={{ marginBottom: 24, background: '#fafafa' }}
                            title={<Title level={4} style={{ margin: 0 }}>Quick Add Variants</Title>}
                        >
                            <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
                                Select a color and multiple sizes to quickly add variants
                            </Text>
                            <Row gutter={16}>
                                <Col xs={24} md={8}>
                                    <Text strong style={{ fontSize: 13, color: "#595959", display: "block", marginBottom: 8 }}>
                                        Color (Optional)
                                    </Text>
                                    <Select
                                        style={{ width: "100%" }}
                                        placeholder="Select a color"
                                        value={quickColorId}
                                        onChange={setQuickColorId}
                                        size="large"
                                        allowClear
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
                                </Col>
                                <Col xs={24} md={16}>
                                    <Text strong style={{ fontSize: 13, color: "#595959", display: "block", marginBottom: 8 }}>
                                        Sizes (Select multiple)
                                    </Text>
                                    <Select
                                        mode="multiple"
                                        style={{ width: "100%" }}
                                        placeholder="Select one or more sizes"
                                        value={quickSizeIds}
                                        onChange={setQuickSizeIds}
                                        size="large"
                                    >
                                        {sizes.map((size) => (
                                            <Option key={size.id} value={size.id}>
                                                {size.display_name || size.name}
                                            </Option>
                                        ))}
                                    </Select>
                                </Col>
                            </Row>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={quickAddVariants}
                                style={{ marginTop: 16 }}
                                size="large"
                            >
                                Add Variants ({quickSizeIds.length || 1} variant{quickSizeIds.length > 1 ? 's' : ''})
                            </Button>
                        </Card>

                        {/* Variants List */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <Title level={4} style={{ margin: 0 }}>Product Variants ({variants.length})</Title>
                        </div>

                        {variants.length === 0 && (
                            <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
                                No variants added. Click "Add Variant" to create size/color combinations.
                            </Text>
                        )}

                        {variants.map((variant, index) => (
                            <Card
                                key={index}
                                size="small"
                                style={{ marginBottom: 16 }}
                                title={`Variant ${index + 1}`}
                                extra={
                                    <Button
                                        type="text"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => removeVariant(index)}
                                    >
                                        Remove
                                    </Button>
                                }
                            >
                                <Row gutter={16}>
                                    <Col xs={24} md={12}>
                                        <Text strong style={{ fontSize: 13, color: "#595959" }}>Color</Text>
                                        <Select
                                            style={{ width: "100%", marginTop: 8 }}
                                            placeholder="Select color"
                                            allowClear
                                            size="large"
                                            value={variant.color_id}
                                            onChange={(value) => updateVariant(index, "color_id", value)}
                                            optionLabelProp="label"
                                        >
                                            {colors.map((color) => (
                                                <Option
                                                    key={color.id}
                                                    value={color.id}
                                                    label={
                                                        <Space>
                                                            {color.hex_code && (
                                                                <span
                                                                    style={{
                                                                        display: "inline-block",
                                                                        width: 14,
                                                                        height: 14,
                                                                        backgroundColor: color.hex_code,
                                                                        border: "1px solid #d9d9d9",
                                                                        borderRadius: 3,
                                                                    }}
                                                                />
                                                            )}
                                                            {color.display_name || color.name}
                                                        </Space>
                                                    }
                                                >
                                                    <Space>
                                                        {color.hex_code && (
                                                            <span
                                                                style={{
                                                                    display: "inline-block",
                                                                    width: 20,
                                                                    height: 20,
                                                                    backgroundColor: color.hex_code,
                                                                    border: "2px solid #d9d9d9",
                                                                    borderRadius: 4,
                                                                }}
                                                            />
                                                        )}
                                                        <span style={{ fontWeight: 500 }}>
                                                            {color.display_name || color.name}
                                                        </span>
                                                    </Space>
                                                </Option>
                                            ))}
                                        </Select>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Text strong style={{ fontSize: 13, color: "#595959" }}>Size</Text>
                                        <Select
                                            style={{ width: "100%", marginTop: 8 }}
                                            placeholder="Select size"
                                            allowClear
                                            size="large"
                                            value={variant.size_id}
                                            onChange={(value) => updateVariant(index, "size_id", value)}
                                        >
                                            {sizes.map((size) => (
                                                <Option key={size.id} value={size.id}>
                                                    <span style={{ fontWeight: 500 }}>
                                                        {size.display_name || size.name}
                                                    </span>
                                                </Option>
                                            ))}
                                        </Select>
                                    </Col>
                                </Row>
                                <Row gutter={16} style={{ marginTop: 16 }}>
                                    <Col xs={24} md={12}>
                                        <Text strong style={{ fontSize: 13, color: "#595959" }}>SKU (optional)</Text>
                                        <Input
                                            style={{ marginTop: 8 }}
                                            size="large"
                                            placeholder="e.g., TSHIRT-RED-M"
                                            value={variant.sku}
                                            onChange={(e) => updateVariant(index, "sku", e.target.value)}
                                        />
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Text strong style={{ fontSize: 13, color: "#595959" }}>Price Override (optional)</Text>
                                        <Space.Compact style={{ width: "100%", marginTop: 8 }}>
                                            <InputNumber
                                                style={{ width: "100%" }}
                                                size="large"
                                                placeholder="Leave empty to use base price"
                                                min={0}
                                                step={0.01}
                                                precision={2}
                                                value={variant.price}
                                                onChange={(value) => updateVariant(index, "price", value)}
                                            />
                                            <Input
                                                style={{ width: 60 }}
                                                size="large"
                                                value="DT"
                                                disabled
                                            />
                                        </Space.Compact>
                                    </Col>
                                </Row>
                                <Row gutter={16} style={{ marginTop: 16 }}>
                                    <Col xs={24} md={12}>
                                        <Text strong style={{ fontSize: 13, color: "#595959" }}>Stock Quantity</Text>
                                        <InputNumber
                                            style={{ width: "100%", marginTop: 8 }}
                                            size="large"
                                            placeholder="0"
                                            min={0}
                                            value={variant.stock}
                                            onChange={(value) => updateVariant(index, "stock", value || 0)}
                                        />
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Text strong style={{ fontSize: 13, color: "#595959" }}>Status</Text>
                                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
                                            <Switch
                                                checked={variant.is_available}
                                                onChange={(checked) => updateVariant(index, "is_available", checked)}
                                            />
                                            <span style={{ color: variant.is_available ? "#52c41a" : "#8c8c8c" }}>
                                                {variant.is_available ? "Available" : "Unavailable"}
                                            </span>
                                        </div>
                                    </Col>
                                </Row>

                                {/* Variant-specific images */}
                                <Divider style={{ margin: "16px 0" }} />
                                <div>
                                    <Text strong style={{ display: "block", marginBottom: 8 }}>
                                        Variant Images (optional)
                                    </Text>
                                    <Text type="secondary" style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
                                        Upload images specific to this color/size combination
                                    </Text>
                                    <Upload
                                        listType="picture-card"
                                        fileList={variant.images || []}
                                        onChange={({ fileList }) => updateVariant(index, "images", fileList)}
                                        beforeUpload={() => false}
                                        multiple
                                    >
                                        {(variant.images?.length || 0) < 5 && (
                                            <div>
                                                <PlusOutlined />
                                                <div style={{ marginTop: 8 }}>Upload</div>
                                            </div>
                                        )}
                                    </Upload>
                                </div>
                            </Card>
                        ))}

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
                                    Update Product
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
        </Spin>
    );
}

