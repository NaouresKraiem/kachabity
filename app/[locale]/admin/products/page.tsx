"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import StaticHeader from "@/components/layout/StaticHeader";
import { FormInput, FormSelect, FormTextarea } from "@/components/forms";
import ImageUpload from "@/components/admin/ImageUpload";
import MultiImageUpload, { GalleryImage } from "@/components/admin/MultiImageUpload";
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
    categories?: {
        name: string;
        slug: string;
    };
    image_url: string;
    images?: GalleryImage[];
    is_featured: boolean;
    created_at: string;
}

interface ProductFormData {
    title: string;
    description?: string;
    price_cents: number;
    currency: string;
    discount_percent?: number;
    image_url: string;
    images?: GalleryImage[];
    stock: number;
    category_id?: string;
    is_featured: boolean;
    is_promo: boolean;
    promo_end_date?: string;
}

export default function AdminProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ProductFormData>({
        defaultValues: {
            currency: 'TND',
            is_featured: false,
            is_promo: false,
            stock: 0,
            price_cents: 0,
            images: []
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
        setValue('images', product.images || []);
        setIsModalVisible(true);
    };

    const handleCloseModal = () => {
        setIsModalVisible(false);
        setEditingProduct(null);
        reset();
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
            title: 'Category',
            dataIndex: 'categories',
            key: 'categories',
            width: 150,
            render: (categories: { name: string } | undefined) => categories?.name || '-'
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
                        className="text-[#7a3b2e] hover:underline"
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

    return (
        <>
            <StaticHeader />
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">Product Management</h1>
                        <button
                            onClick={() => setIsModalVisible(true)}
                            className="px-6 py-3 bg-[#7a3b2e] text-white rounded-lg hover:bg-[#6b2516] transition font-medium"
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
                width={700}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">

                    {/* Product Title */}
                    <FormInput
                        label="Product Title"
                        name="title"
                        register={register}
                        error={errors.title}
                        required
                        placeholder="Enter product title"
                    />

                    {/* Description */}
                    <FormTextarea
                        label="Product Description"
                        name="description"
                        register={register}
                        rows={3}
                        placeholder="Describe your product..."
                    />

                    {/* Category */}
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

                    {/* Price & Currency */}
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput
                            label="Price"
                            name="price_cents"
                            type="number"
                            register={register}
                            error={errors.price_cents}
                            required
                            placeholder="0"
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

                    {/* Stock & Discount */}
                    <div className="grid grid-cols-2 gap-4">
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
                            label="Discount %"
                            name="discount_percent"
                            type="number"
                            register={register}
                            placeholder="0"
                        />
                    </div>

                    {/* Primary Image Upload */}
                    <ImageUpload
                        label="Primary Image"
                        value={watch('image_url')}
                        onChange={(url) => setValue('image_url', url)}
                        required
                    />

                    {/* Gallery Images */}
                    <MultiImageUpload
                        label="Gallery Images"
                        value={watch('images') || []}
                        onChange={(imgs) => setValue('images', imgs)}
                        onPrimaryChange={(url) => setValue('image_url', url)}
                    />

                    {/* Or Manual URL */}
                    <div className="text-center text-sm text-gray-500">Or</div>

                    <FormInput
                        label="Image URL (if not uploading)"
                        name="image_url"
                        register={register}
                        error={errors.image_url}
                        placeholder="https://example.com/image.jpg"
                    />

                    {/* Featured Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <label className="text-sm font-medium text-gray-700">
                            Featured Product (Show on homepage)
                        </label>
                        <input
                            type="checkbox"
                            {...register('is_featured')}
                            className="w-5 h-5 text-[#7a3b2e] border-gray-300 rounded focus:ring-[#7a3b2e]"
                        />
                    </div>

                    {/* Promotional Product Toggle */}
                    <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div>
                            <label className="text-sm font-medium text-gray-700">
                                🔥 Promotional Product
                            </label>
                            <p className="text-xs text-gray-500 mt-1">
                                Mark as limited-time offer with countdown timer
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            {...register('is_promo')}
                            className="w-5 h-5 text-[#7a3b2e] border-gray-300 rounded focus:ring-[#7a3b2e]"
                        />
                    </div>

                    {/* Promo End Date (conditional) */}
                    {watch('is_promo') && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Promotion End Date & Time
                                    <span className="text-red-500 ml-1">*</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    {...register('promo_end_date')}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7a3b2e] focus:border-transparent transition"
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    ⏰ A countdown timer will be displayed on the product
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex justify-end gap-2 pt-4 border-t">
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
                            className="px-6 py-2 bg-[#7a3b2e] text-white rounded-lg hover:bg-[#6b2516] transition disabled:opacity-50"
                        >
                            {submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}

