"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import StaticHeader from "@/components/layout/StaticHeader";
import { FormInput, FormSelect, FormTextarea } from "@/components/forms";
import ImageUpload from "@/components/admin/ImageUpload";
import { Table, Modal, message, Space, Tag } from "antd";
import type { ColumnsType } from 'antd/es/table';

interface Category {
    id: string;
    name: string;
    slug: string;
}

interface Product {
    id: string;
    title: string;
    slug: string;
    price_cents: number;
    currency: string;
    stock: number;
    category_id: string;
    image_url: string;
    is_featured: boolean;
    created_at: string;
}

interface ProductFormData {
    title: string;
    slug?: string;
    description?: string;
    price_cents: number;
    currency: string;
    discount_percent?: number;
    image_url: string;
    stock: number;
    category_id?: string;
    is_featured: boolean;
}

const SIZES = ["S", "M", "L", "XL", "XXL", "XXXL", "4XL"];
const COLORS = ["#D4AF37", "#2F4F4F", "#DEB887", "#9370DB", "#FF6B6B", "#4ECDC4", "#45B7D1"];

export default function AdminProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<string>("basic");

    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ProductFormData>({
        defaultValues: {
            currency: 'TND',
            is_featured: false,
            is_promo: false,
            stock: 0,
            price_cents: 0
        }
    });


    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/products');
            const result = await response.json();
            if (result.success) {
                setProducts(result.data);
            }
        } catch (error) {
            message.error('Failed to fetch products');
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/admin/categories');
            const result = await response.json();
            if (result.success) {
                setCategories(result.data);
            }
        } catch (error) {
            console.error('Failed to fetch categories from API');
        }
    };

    const onSubmit = async (data: ProductFormData) => {
        setSubmitting(true);
        try {
            const url = '/api/admin/products';
            const method = editingProduct ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingProduct ? { ...data, id: editingProduct.id } : data)
            });

            const result = await response.json();

            if (result.success) {
                message.success(editingProduct ? 'Product updated successfully!' : 'Product created successfully!');
                fetchProducts();
                handleCloseModal();
            } else {
                message.error(result.error || 'Failed to save product');
            }
        } catch (error) {
            message.error('An error occurred while saving the product');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        Modal.confirm({
            title: 'Are you sure you want to delete this product?',
            content: 'This action cannot be undone.',
            okText: 'Yes, Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    const response = await fetch(`/api/admin/products?id=${id}`, {
                        method: 'DELETE'
                    });

                    const result = await response.json();

                    if (result.success) {
                        message.success('Product deleted successfully!');
                        fetchProducts();
                    } else {
                        message.error(result.error || 'Failed to delete product');
                    }
                } catch (error) {
                    message.error('An error occurred while deleting the product');
                }
            }
        });
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        Object.keys(product).forEach((key) => {
            setValue(key as any, (product as any)[key]);
        });
        setIsModalVisible(true);
    };

    const handleCloseModal = () => {
        setIsModalVisible(false);
        setEditingProduct(null);
        reset();
        setActiveTab("basic");
    };

    const columns: ColumnsType<Product> = [
        {
            title: 'Image',
            dataIndex: 'image_url',
            key: 'image_url',
            width: 80,
            render: (url: string) => (
                <img src={url} alt="Product" className="w-16 h-16 object-cover rounded" />
            )
        },
        {
            title: 'Title',
            dataIndex: 'title',
            key: 'title',
            width: 200
        },
        {
            title: 'Price',
            dataIndex: 'price_cents',
            key: 'price_cents',
            width: 120,
            render: (price: number, record: Product) => `${price} ${record.currency}`
        },
        {
            title: 'Stock',
            dataIndex: 'stock',
            key: 'stock',
            width: 80
        },
        {
            title: 'Featured',
            dataIndex: 'is_featured',
            key: 'is_featured',
            width: 100,
            render: (isFeatured: boolean) => (
                <Tag color={isFeatured ? 'green' : 'default'}>
                    {isFeatured ? 'Yes' : 'No'}
                </Tag>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 150,
            render: (_: any, record: Product) => (
                <Space>
                    <button
                        onClick={() => handleEdit(record)}
                        className="text-[#842E1B] hover:underline"
                    >
                        Edit
                    </button>
                    <button
                        onClick={() => handleDelete(record.id)}
                        className="text-red-600 hover:underline"
                    >
                        Delete
                    </button>
                </Space>
            )
        }
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case "basic":
                return (
                    <div className="space-y-4">
                        <FormInput
                            label="Product Title"
                            name="title"
                            register={register}
                            error={errors.title}
                            required
                            placeholder="Product Title"
                        />

                        <FormTextarea
                            label="Product Description"
                            name="description"
                            register={register}
                            rows={4}
                            placeholder="Describe your product..."
                        />

                        <FormSelect
                            label="Category"
                            name="category_id"
                            register={register}
                            options={[
                                { value: "", label: "Select category" },
                                ...categories.map(cat => ({
                                    value: cat.id,
                                    label: cat.name
                                }))
                            ]}
                        />

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800">
                                💡 <strong>Auto-translation:</strong> Content will be automatically translated to Arabic and French for your customers.
                            </p>
                        </div>
                    </div>
                );

            case "pricing":
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormInput
                                label="Price"
                                name="price_cents"
                                type="number"
                                register={register}
                                error={errors.price_cents}
                                required
                                placeholder="0.00"
                            />

                            <FormSelect
                                label="Currency"
                                name="currency"
                                register={register}
                                options={[
                                    { value: "TND", label: "TND" },
                                    { value: "USD", label: "USD" },
                                    { value: "EUR", label: "EUR" }
                                ]}
                            />
                        </div>

                        <FormInput
                            label="Discount Percentage"
                            name="discount_percent"
                            type="number"
                            register={register}
                            placeholder="0"
                        />

                        <FormInput
                            label="Stock"
                            name="stock"
                            type="number"
                            register={register}
                            error={errors.stock}
                            required
                            placeholder="0"
                        />

                        <FormInput
                            label="Weight (grams)"
                            name="weight"
                            type="number"
                            register={register}
                            placeholder="0"
                        />
                    </div>
                );

            case "media":
                return (
                    <div className="space-y-4">
                        <ImageUpload
                            label="Main Product Image"
                            value={watch('image_url')}
                            onChange={(url) => setValue('image_url', url)}
                            required
                        />

                        <div className="border-t pt-4">
                            <p className="text-sm text-gray-600 mb-2">
                                Or enter image URL manually:
                            </p>
                            <FormInput
                                label="Image URL"
                                name="image_url"
                                register={register}
                                error={errors.image_url}
                                placeholder="https://example.com/image.jpg"
                            />
                        </div>

                        <div className="border-t pt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Additional Images (one URL per line or upload multiple)
                            </label>
                            <textarea
                                value={additionalImages}
                                onChange={(e) => setAdditionalImages(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#842E1B] focus:border-transparent transition resize-none"
                                placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Tip: Upload images one by one and copy the URL here
                            </p>
                        </div>
                    </div>
                );

            case "variants":
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Available Sizes</label>
                            <div className="flex flex-wrap gap-2">
                                {SIZES.map(size => (
                                    <button
                                        key={size}
                                        type="button"
                                        onClick={() => {
                                            setSelectedSizes(prev =>
                                                prev.includes(size)
                                                    ? prev.filter(s => s !== size)
                                                    : [...prev, size]
                                            );
                                        }}
                                        className={`px-4 py-2 rounded-lg border-2 transition ${selectedSizes.includes(size)
                                            ? 'bg-[#842E1B] text-white border-[#842E1B]'
                                            : 'bg-white text-gray-700 border-gray-300 hover:border-[#842E1B]'
                                            }`}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Available Colors</label>
                            <div className="flex flex-wrap gap-2">
                                {COLORS.map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => {
                                            setSelectedColors(prev =>
                                                prev.includes(color)
                                                    ? prev.filter(c => c !== color)
                                                    : [...prev, color]
                                            );
                                        }}
                                        className={`w-10 h-10 rounded-full border-2 ${selectedColors.includes(color)
                                            ? 'border-black'
                                            : 'border-gray-300'
                                            }`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case "additional":
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Product Details (one per line)
                            </label>
                            <textarea
                                value={productDetails}
                                onChange={(e) => setProductDetails(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#842E1B] focus:border-transparent transition resize-none"
                                placeholder="100% handmade&#10;Premium quality materials&#10;Traditional craftsmanship"
                            />
                        </div>

                        <FormTextarea
                            label="Shipping Information"
                            name="shipping_info"
                            register={register}
                            rows={2}
                            placeholder="Free shipping on orders over 100 TND"
                        />

                        <FormInput
                            label="Seller Information"
                            name="seller_info"
                            register={register}
                            placeholder="Kachabity - Traditional Handcrafted Products"
                        />

                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <label className="text-sm font-medium text-gray-700">Featured Product</label>
                                <input
                                    type="checkbox"
                                    {...register('is_featured')}
                                    className="w-5 h-5 text-[#842E1B] border-gray-300 rounded focus:ring-[#842E1B]"
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <label className="text-sm font-medium text-gray-700">Promotional Product</label>
                                <input
                                    type="checkbox"
                                    {...register('is_promo')}
                                    className="w-5 h-5 text-[#842E1B] border-gray-300 rounded focus:ring-[#842E1B]"
                                />
                            </div>
                        </div>

                        {watch('is_promo') && (
                            <FormInput
                                label="Promo End Date"
                                name="promo_end_date"
                                type="text"
                                register={register}
                                placeholder="YYYY-MM-DDTHH:MM"
                            />
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <>
            <StaticHeader />
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">Product Management</h1>
                        <button
                            onClick={() => setIsModalVisible(true)}
                            className="px-6 py-3 bg-[#842E1B] text-white rounded-lg hover:bg-[#6b2516] transition font-medium"
                        >
                            + Add New Product
                        </button>
                    </div>

                    <div className="bg-white rounded-lg shadow">
                        <Table
                            columns={columns}
                            dataSource={products}
                            loading={loading}
                            rowKey="id"
                            pagination={{ pageSize: 10 }}
                            scroll={{ x: 1000 }}
                        />
                    </div>
                </div>
            </div>

            {/* Product Form Modal */}
            <Modal
                title={editingProduct ? "Edit Product" : "Add New Product"}
                open={isModalVisible}
                onCancel={handleCloseModal}
                footer={null}
                width={900}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Tab Navigation */}
                    <div className="flex border-b border-gray-200">
                        {[
                            { key: "basic", label: "Basic Info" },
                            { key: "pricing", label: "Pricing & Stock" },
                            { key: "media", label: "Media" },
                            { key: "variants", label: "Variants" },
                            { key: "additional", label: "Additional Info" }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-4 py-2 text-sm font-medium transition ${activeTab === tab.key
                                    ? 'text-[#842E1B] border-b-2 border-[#842E1B]'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="py-4">
                        {renderTabContent()}
                    </div>

                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                        <button
                            type="button"
                            onClick={handleCloseModal}
                            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2 bg-[#842E1B] text-white rounded-lg hover:bg-[#6b2516] transition disabled:opacity-50"
                        >
                            {submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
