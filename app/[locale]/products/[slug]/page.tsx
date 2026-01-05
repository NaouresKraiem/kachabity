"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Link from "next/link";
import supabase from "@/lib/supabaseClient";
import StaticHeader from "@/components/layout/StaticHeader";
import Footer from "@/components/footer/Footer";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { FormTextarea, FormInput } from "@/components/forms";
import { Image as AntImage, Divider, message } from "antd";
import toast from "react-hot-toast";
import { headerConfig } from "@/lib/config";

interface ProductImage {
    id: string;
    url: string;
    alt?: string;
}

interface Color {
    id: string;
    name: string;
    hex_code?: string;
    display_name?: string;
}

interface Size {
    id: string;
    name: string;
    code?: string;
    display_name?: string;
}

interface ProductVariant {
    id: string;
    product_id: string;
    // New structure with foreign keys
    color_id?: string | null;
    size_id?: string | null;
    // Joined data
    colors?: Color;
    sizes?: Size;
    // Legacy fields (for backward compatibility)
    color?: string;
    size?: string;
    sku?: string;
    price_cents?: number;
    price?: number;
    stock: number;
    images?: ProductImage[];
    image_url?: string;
    is_available?: boolean;
    is_active?: boolean;
}

interface Product {
    id: string;
    name: string;
    name_ar?: string;
    name_fr?: string;
    slug: string;
    description?: string;
    description_ar?: string;
    description_fr?: string;
    base_price: number;
    currency?: string;
    discount_percent?: number;
    image_url?: string;
    product_images?: ProductImage[];
    stock?: number;
    category_id?: string;
    colors?: string[];
    sizes?: string[];
    weight?: number;
    product_details?: string[];
    shipping_info?: string;
    seller_info?: string;
    views?: number;
    product_variants?: ProductVariant[];
}

interface Category {
    id: string;
    name: string;
    name_ar?: string;
    name_fr?: string;
    slug: string;
}

// Helper function to get translated category name
function getCategoryName(category: Category, locale: string): string {
    if (locale === 'ar' && category.name_ar) {
        return category.name_ar;
    }
    if (locale === 'fr' && category.name_fr) {
        return category.name_fr;
    }
    return category.name;
}

interface Review {
    id: string;
    product_id: string;
    user_id?: string;
    user_name?: string;
    rating: number;
    comment: string;
    created_at: string;
    users?: {
        name: string;
        avatar_url?: string;
    };
}

const commentSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
    comment: z.string().trim().min(5, "Comment is too short").max(2000, "Comment is too long"),
    rating: z.number().min(1).max(5).optional(),
});

type CommentFormData = z.infer<typeof commentSchema>;

const content = {
    en: {
        home: "Home",
        category: "Category",
        status: "Status",
        inStock: "In Stock",
        outOfStock: "Out of Stock",
        reviews: "reviews",
        quantity: "Quantity",
        selectColor: "Select Color",
        selectSize: "Select Size",
        addToCart: "Add to cart",
        productDetails: "Product Details",
        shippingDetails: "Shipping Details",
        sellerDetails: "Seller Details",
        similarProducts: "Similar Products",
        homeDelivery: "Home Delivery",
        deliveryCost: "Delivery cost",
        relatedCategories: "Explore related categories",
        loading: "Loading product...",
        comments: "Comments",
        writeComment: "Write your Comment",
        commentPlaceholder: "Share your thoughts about this product...",
        yourName: "Your Name",
        namePlaceholder: "Enter your name",
        yourRating: "Your Rating",
        send: "Send",
        helpful: "Helpful",
        reportAbuse: "Report Abuse",
        submittingComment: "Submitting...",
        commentSuccess: "Comment submitted successfully!",
        commentError: "Failed to submit comment. Please try again."
    },
    fr: {
        home: "Accueil",
        category: "Catégorie",
        status: "Statut",
        inStock: "En stock",
        outOfStock: "Rupture de stock",
        reviews: "avis",
        quantity: "Quantité",
        selectColor: "Sélectionner la couleur",
        selectSize: "Sélectionner la taille",
        addToCart: "Ajouter au panier",
        productDetails: "Détails du produit",
        shippingDetails: "Détails de livraison",
        sellerDetails: "Détails du vendeur",
        similarProducts: "Produits similaires",
        homeDelivery: "Livraison à domicile",
        deliveryCost: "Frais de livraison",
        relatedCategories: "Explorer les catégories connexes",
        loading: "Chargement du produit...",
        comments: "Commentaires",
        writeComment: "Écrivez votre commentaire",
        commentPlaceholder: "Partagez vos impressions sur ce produit...",
        yourName: "Votre nom",
        namePlaceholder: "Entrez votre nom",
        yourRating: "Votre évaluation",
        send: "Envoyer",
        helpful: "Utile",
        reportAbuse: "Signaler un abus",
        submittingComment: "Envoi en cours...",
        commentSuccess: "Commentaire soumis avec succès!",
        commentError: "Échec de l'envoi du commentaire. Veuillez réessayer."
    },
    ar: {
        home: "الرئيسية",
        category: "الفئة",
        status: "الحالة",
        inStock: "متوفر",
        outOfStock: "غير متوفر",
        reviews: "تقييم",
        quantity: "الكمية",
        selectColor: "اختر اللون",
        selectSize: "اختر المقاس",
        addToCart: "أضف إلى السلة",
        productDetails: "تفاصيل المنتج",
        shippingDetails: "تفاصيل الشحن",
        sellerDetails: "تفاصيل البائع",
        similarProducts: "منتجات مماثلة",
        homeDelivery: "التوصيل المنزلي",
        deliveryCost: "تكلفة التوصيل",
        relatedCategories: "استكشف الفئات ذات الصلة",
        loading: "جاري تحميل المنتج...",
        comments: "التعليقات",
        writeComment: "اكتب تعليقك",
        commentPlaceholder: "شارك أفكارك حول هذا المنتج...",
        yourName: "اسمك",
        namePlaceholder: "أدخل اسمك",
        yourRating: "تقييمك",
        send: "إرسال",
        helpful: "مفيد",
        reportAbuse: "الإبلاغ عن إساءة",
        submittingComment: "جاري الإرسال...",
        commentSuccess: "تم إرسال التعليق بنجاح!",
        commentError: "فشل إرسال التعليق. يرجى المحاولة مرة أخرى."
    }
};

export default function ProductDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const locale = (params.locale as string) || 'en';
    const text = content[locale as keyof typeof content] || content.en;
    const slug = params.slug as string;
    const categorySlug = searchParams.get('category');

    const [product, setProduct] = useState<Product | null>();
    const [categoryName, setCategoryName] = useState<string>('');
    const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
    const [relatedCategories, setRelatedCategories] = useState<Category[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [selectedSize, setSelectedSize] = useState<string | null>(null);
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
    const [expandedSection, setExpandedSection] = useState<string[]>([
        "product",
        "shipping",
        "seller",
    ]);
    const [submittingComment, setSubmittingComment] = useState(false);
    const [selectedRating, setSelectedRating] = useState(5);
    const [visibleComments, setVisibleComments] = useState(3);
    const { register, handleSubmit, reset, formState: { errors } } = useForm<CommentFormData>({
        resolver: zodResolver(commentSchema)
    });

    useEffect(() => {
        async function fetchProduct() {
            console.log('Fetching product with slug:', slug);
            try {
                // Fetch product first without variants relation to avoid potential relationship errors
                const { data: productData, error: productError } = await supabase
                    .from('products')
                    .select('*')
                    .eq('slug', slug)
                    .is('deleted_at', null)
                    .eq('status', 'active')
                    .single();

                if (productError) throw productError;

                let data = productData;
                if (data) {
                    // Fetch product images
                    const { data: imagesData, error: imagesError } = await supabase
                        .from('product_images')
                        .select('*')
                        .eq('product_id', data.id)
                        .is('variant_id', null) // Only product-level images, not variant-specific
                        .order('position', { ascending: true });

                    if (!imagesError && imagesData) {
                        data.product_images = imagesData.map((img: any) => ({
                            id: img.id,
                            url: img.image_url,
                            alt: img.alt_text,
                        }));
                    }

                    // Fetch variants with colors and sizes joined
                    const { data: variantsData, error: variantsError } = await supabase
                        .from('product_variants')
                        .select(`
                            *,
                            colors (
                                id,
                                name,
                                hex_code,
                                display_name
                            ),
                            sizes (
                                id,
                                name,
                                display_name
                            )
                        `)
                        .eq('product_id', data.id)
                        .is('deleted_at', null);

                    if (variantsError) {
                        console.error('Error fetching variants:', variantsError);
                    } else {
                        // Fetch images for each variant
                        if (variantsData && variantsData.length > 0) {
                            const { data: variantImagesData, error: variantImagesError } = await supabase
                                .from('product_images')
                                .select('*')
                                .eq('product_id', data.id)
                                .not('variant_id', 'is', null)
                                .order('position', { ascending: true });

                            if (!variantImagesError && variantImagesData) {
                                // Attach images to each variant
                                variantsData.forEach((variant: any) => {
                                    variant.images = variantImagesData
                                        .filter((img: any) => img.variant_id === variant.id)
                                        .map((img: any) => ({
                                            id: img.id,
                                            url: img.image_url,
                                            alt: img.alt_text,
                                        }));
                                });
                            }
                        }

                        // explicit cast to any to allow merging variants
                        data = { ...data, product_variants: (variantsData || []) as ProductVariant[] };
                    }

                    const productWithVariants = data as Product;
                    setProduct(productWithVariants);

                    // Handle variants if they exist
                    if (productWithVariants.product_variants && Array.isArray(productWithVariants.product_variants) && productWithVariants.product_variants.length > 0) {
                        // Get unique colors from variants (using color_id)
                        const uniqueColorIds = [...new Set(productWithVariants.product_variants
                            .filter((v: ProductVariant) => v.color_id && (v.is_available !== false))
                            .map((v: ProductVariant) => v.color_id!))];

                        // Get unique sizes from variants (using size_id)
                        const uniqueSizeIds = [...new Set(productWithVariants.product_variants
                            .filter((v: ProductVariant) => v.size_id && (v.is_available !== false))
                            .map((v: ProductVariant) => v.size_id!))];

                        // Set default color if available
                        if (uniqueColorIds.length > 0) {
                            setSelectedColor(uniqueColorIds[0]);
                            // Find first variant with this color
                            const firstVariant = productWithVariants.product_variants.find((v: ProductVariant) => v.color_id === uniqueColorIds[0] && (v.is_available !== false));
                            if (firstVariant) {
                                setSelectedVariant(firstVariant);
                                if (firstVariant.size_id) {
                                    setSelectedSize(firstVariant.size_id);
                                }
                            }
                        }

                        // Set default size if no color selected
                        if (!selectedColor && uniqueSizeIds.length > 0) {
                            setSelectedSize(uniqueSizeIds[0]);
                        }
                    } else {
                        // Fallback to old colors/sizes arrays if no variants
                        if (data.colors && data.colors.length > 0) {
                            setSelectedColor(data.colors[0]);
                        }
                        if (data.sizes && data.sizes.length > 0) {
                            setSelectedSize(data.sizes[0]);
                        }
                    }

                    // Fetch similar products
                    if (data.category_id) {
                        const { data: similarData } = await supabase
                            .from('products')
                            .select('*')
                            .eq('category_id', data.category_id)
                            .neq('id', data.id)
                            .is('deleted_at', null)
                            .eq('status', 'active')
                            .limit(4);

                        if (similarData) {
                            setSimilarProducts(similarData);
                        }
                        // Fetch related categories excluding current
                        let { data: catData, error: catError } = await supabase
                            .from('categories')
                            .select('id, name, name_ar, name_fr, slug')
                            .neq('id', data.category_id)
                            .order('name', { ascending: true })
                            .limit(6);

                        // If error, try without translation fields
                        if (catError) {
                            const fallbackResult = await supabase
                                .from('categories')
                                .select('id, name, slug')
                                .neq('id', data.category_id)
                                .order('name', { ascending: true })
                                .limit(6);
                            if (!fallbackResult.error) {
                                catData = fallbackResult.data;
                            }
                        }

                        if (catData) {
                            setRelatedCategories(catData);
                        }
                    } else {
                        // Fallback: fetch some categories
                        let { data: catData, error: catError } = await supabase
                            .from('categories')
                            .select('id, name, name_ar, name_fr, slug')
                            .order('name', { ascending: true })
                            .limit(6);

                        // If error, try without translation fields
                        if (catError) {
                            const fallbackResult = await supabase
                                .from('categories')
                                .select('id, name, slug')
                                .order('name', { ascending: true })
                                .limit(6);
                            if (!fallbackResult.error) {
                                catData = fallbackResult.data;
                            }
                        }

                        if (catData) {
                            setRelatedCategories(catData);
                        }
                    }

                    // Fetch reviews for this product
                    const { data: reviewsData } = await supabase
                        .from('reviews')
                        .select(`
                            *,
                            users (
                                name,
                                avatar_url
                            )
                        `)
                        .eq('product_id', data.id)
                        .order('created_at', { ascending: false });

                    if (reviewsData) {
                        setReviews(reviewsData);
                    }

                }
            } catch (error) {
                console.error('Error fetching product:', error);
                console.error('Error details:', JSON.stringify(error, null, 2));
            } finally {
                setLoading(false);
            }
        }

        fetchProduct();
    }, [slug]);


    // Fetch category name if categorySlug is provided
    useEffect(() => {
        async function fetchCategoryName() {
            if (categorySlug) {
                try {
                    // Try to fetch with translation fields first
                    let { data, error } = await supabase
                        .from('categories')
                        .select('name, name_ar, name_fr')
                        .eq('slug', categorySlug)
                        .single();

                    // If error, try without translation fields (fallback)
                    if (error) {
                        const fallbackResult = await supabase
                            .from('categories')
                            .select('name')
                            .eq('slug', categorySlug)
                            .single();

                        if (fallbackResult.error) {
                            throw fallbackResult.error;
                        }
                        data = fallbackResult.data;
                        error = null;
                    }

                    if (data && !error) {
                        setCategoryName(getCategoryName(data, locale));
                    }
                } catch (error) {
                    console.error('Error fetching category:', error);
                }
            }
        }

        fetchCategoryName();
    }, [categorySlug, locale]);


    // Calculate average rating from reviews
    const averageRating = reviews.length > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
        : 0;
    const reviewCount = reviews.length;

    const onSubmitComment = async (data: CommentFormData) => {
        if (!product) return;

        // Zod validates name and comment; only guard rating here
        const rating = Number(selectedRating);
        if (!(rating >= 1 && rating <= 5)) {
            message.error('Rating must be between 1 and 5.');
            return;
        }

        setSubmittingComment(true);
        try {
            const { error } = await supabase
                .from('reviews')
                .insert({
                    product_id: product.id,
                    user_name: (data.name || '').trim(),
                    rating,
                    comment: (data.comment || '').trim(),
                });

            if (error) throw error;

            // Refresh reviews
            const { data: reviewsData } = await supabase
                .from('reviews')
                .select(`
                    *,
                    users (
                        name,
                        avatar_url
                    )
                `)
                .eq('product_id', product.id)
                .order('created_at', { ascending: false });

            if (reviewsData) {
                setReviews(reviewsData);
            }

            // Reset form
            reset();
            setSelectedRating(5);
            // message.success(text.commentSuccess);
            toast.success(text.commentSuccess);


        } catch (error) {
            console.error('Error submitting comment:', error);
            // message.error(text.commentError)
            toast.error(text.commentError);

        } finally {
            setSubmittingComment(false);
        }
    };

    if (loading) {
        return <LoadingSpinner message={text.loading} />;
    }

    if (!product) {
        return (
            <>
                <StaticHeader />
                <div className="min-h-screen flex items-center justify-center">
                    <p className="text-xl text-gray-600">Product not found</p>
                </div>
                <Footer />
            </>
        );
    }

    // Calculate price - use variant price if available, otherwise use product price
    const basePrice = selectedVariant?.price || product.base_price;
    const discountedPrice = product.discount_percent
        ? basePrice * (1 - product.discount_percent / 100)
        : basePrice;

    // Get images - use variant images if color is selected and variant has images
    let productImages: ProductImage[] = [];
    if (selectedVariant && selectedVariant.images && selectedVariant.images.length > 0) {
        productImages = selectedVariant.images.filter(img => img.url && img.url.trim() !== '');
    } else if (selectedVariant && selectedVariant.image_url && selectedVariant.image_url.trim() !== '') {
        productImages = [{ id: '1', url: selectedVariant.image_url, alt: product.name }];
    } else if (product.product_images && product.product_images.length > 0) {
        productImages = product.product_images.filter(img => img.url && img.url.trim() !== '');
    } else if (product.image_url && product.image_url.trim() !== '') {
        productImages = [{ id: '1', url: product.image_url, alt: product.name }];
    }

    // Fallback to logo if no valid images
    if (productImages.length === 0) {
        productImages = [{ id: '1', url: '/assets/images/logo.svg', alt: product.name }];
    }

    // Get available colors from variants (with joined color data)
    const availableColors = product.product_variants && product.product_variants.length > 0
        ? product.product_variants
            .filter(v => v.color_id && v.colors && (v.is_available !== false))
            .reduce((acc: Color[], v) => {
                if (v.colors && !acc.find(c => c.id === v.colors!.id)) {
                    acc.push(v.colors);
                }
                return acc;
            }, [])
        : [];

    // Get available sizes based on selected color
    const getAvailableSizes = (): Size[] => {
        if (!product.product_variants || product.product_variants.length === 0) {
            return [];
        }

        const variants = selectedColor
            ? product.product_variants.filter(v => v.color_id === selectedColor && v.size_id && v.sizes && (v.is_available !== false))
            : product.product_variants.filter(v => v.size_id && v.sizes && (v.is_available !== false));

        return variants.reduce((acc: Size[], v) => {
            if (v.sizes && !acc.find(s => s.id === v.sizes!.id)) {
                acc.push(v.sizes);
            }
            return acc;
        }, []);
    };

    const availableSizes = getAvailableSizes();

    // Handle color selection
    const handleColorSelect = (colorId: string) => {
        setSelectedColor(colorId);
        setSelectedImage(0); // Reset to first image

        // Find variant with this color
        if (product.product_variants && product.product_variants.length > 0) {
            const variant = product.product_variants.find(v => v.color_id === colorId && (v.is_available !== false));
            if (variant) {
                setSelectedVariant(variant);
                // Auto-select first available size for this color
                if (variant.size_id) {
                    setSelectedSize(variant.size_id);
                } else {
                    const sizesForColor = getAvailableSizes();
                    if (sizesForColor.length > 0) {
                        setSelectedSize(sizesForColor[0].id);
                    }
                }
            }
        }
    };

    // Handle size selection
    const handleSizeSelect = (sizeId: string) => {
        setSelectedSize(sizeId);

        // Find variant with this color and size
        if (product.product_variants && product.product_variants.length > 0 && selectedColor) {
            const variant = product.product_variants.find(
                v => v.color_id === selectedColor && v.size_id === sizeId && (v.is_available !== false)
            );
            if (variant) {
                setSelectedVariant(variant);
                setSelectedImage(0); // Reset to first image
            }
        }
    };

    // Get current stock - use variant stock if available
    const currentStock = selectedVariant?.stock ?? product.stock ?? 0;


    const toggleSection = (section: string) => {
        setExpandedSection((prev) =>
            prev.includes(section)
                ? prev.filter((s) => s !== section)
                : [...prev, section]
        );
    };

    return (
        <>
            <StaticHeader />
            <div className="min-h-screen bg-white py-8 " >
                <div className="max-w-7xl mx-auto px-4">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-gray-600 mb-8">
                        <Link href={`/${locale}`} className="hover:text-[#7a3b2e]">{text.home}</Link>
                        <span>&gt;</span>
                        {categorySlug && categoryName ? (
                            <>
                                <Link href={`/${locale}/products`} className="hover:text-[#7a3b2e]">{text.category}</Link>
                                <span>&gt;</span>
                                <Link href={`/${locale}/products?category=${categorySlug}`} className="hover:text-[#7a3b2e]">
                                    {categoryName}
                                </Link>
                                <span>&gt;</span>
                            </>
                        ) : (
                            <>
                                <Link href={`/${locale}/products`} className="hover:text-[#7a3b2e]">{text.category}</Link>
                                <span>&gt;</span>
                            </>
                        )}
                        <span className="text-gray-900">{product.name}</span>
                    </nav>

                    {/* Main Product Section */}
                    <div className="grid lg:grid-cols-2 gap-12 mb-16">
                        {/* Left: Images */}
                        <div className="flex flex-col" >
                            <div className="flex gap-4 mb-12">
                                {/* Thumbnail Column */}
                                <div className="flex flex-col gap-3">
                                    {productImages.slice(0, 6).map((img, index) => (
                                        img.url && img.url.trim() !== '' && (
                                            <button
                                                key={`${img.id || img.url}-${index}`}
                                                onClick={() => setSelectedImage(index)}
                                                className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all duration-200 hover:scale-105 ${selectedImage === index
                                                    ? 'border-[#2d2220] shadow-md'
                                                    : 'border-gray-200 hover:border-gray-400'
                                                    }`}
                                            >
                                                <Image
                                                    src={img.url}
                                                    alt={img.alt || product.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </button>
                                        )
                                    ))}
                                </div>

                                {/* Main Image with Preview */}
                                <div className="flex-1">
                                    <AntImage.PreviewGroup
                                        items={productImages
                                            .filter(img => img.url && img.url.trim() !== '')
                                            .map(img => ({
                                                src: img.url,
                                                alt: img.alt || product.name
                                            }))}
                                    >
                                        <AntImage
                                            src={productImages[selectedImage].url}
                                            alt={productImages[selectedImage].alt || product.name}
                                            className="w-full rounded-2xl object-cover shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer"
                                            style={{
                                                aspectRatio: '1/1',
                                                objectFit: 'cover',
                                                height: '539px',
                                                width: '650px',
                                            }}
                                            preview={{
                                                // @ts-ignore - cover is the new API but types not updated yet
                                                cover: (
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <svg
                                                            className="w-10 h-10 text-white"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                                                            />
                                                        </svg>
                                                        <span className="text-white text-sm font-medium">Click to view</span>
                                                    </div>
                                                ),
                                                // @ts-ignore - classNames.cover is the new API but types not updated yet
                                                classNames: { cover: "rounded-2xl backdrop-blur-sm" }
                                            }}
                                        />
                                    </AntImage.PreviewGroup>
                                </div>

                            </div>
                            <div>
                                {/* Similar Products */}
                                {similarProducts.length > 0 && (
                                    <div className="mt-10 mb-12">
                                        <h2 className="text-[16px] font-normal text-[#969696] mb-3">{text.similarProducts}</h2>
                                        <div className="flex flex-wrap gap-4 ">
                                            {similarProducts.map((item) => {
                                                const itemDiscountedPrice = item.discount_percent
                                                    ? item.base_price * (1 - item.discount_percent / 100)
                                                    : item.base_price;

                                                return (
                                                    <Link
                                                        key={item.id}
                                                        href={`/${locale}/products/${item.slug}`}
                                                    // className="group"
                                                    >
                                                        <div className=" rounded-[15px] border border-[#E3E3E3] overflow-hidden shadow-md h-35 w-35">
                                                            {/* Product Image */}
                                                            <div className="relative overflow-hidden h-40 w-40">
                                                                <Image
                                                                    src={item.image_url || '/assets/images/logo.svg'}
                                                                    alt={item.name}
                                                                    fill
                                                                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                                                                />
                                                            </div>
                                                            {/* Product Info */}

                                                        </div>
                                                        <div className="py-4 h-35 w-35">
                                                            <h3 className=" text-base font-normal text-gray-900 mb-1 line-clamp-1">
                                                                {item.name}...
                                                            </h3>
                                                            <p className="text-sm text-gray-500 mb-3">
                                                                Many of us
                                                            </p>
                                                            <p className="text-xl font-semibold text-[#7a3b2e]">
                                                                {Math.round(itemDiscountedPrice).toLocaleString()} {item.currency || 'TND'}
                                                            </p>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Explore Related Categories */}
                            {relatedCategories.length > 0 && (
                                <div className="rounded-2xl">
                                    <h3 className="text-[16px] font-normal text-[#969696] mb-3">{text.relatedCategories}</h3>
                                    <div className="flex flex-wrap gap-3">
                                        {relatedCategories.map((cat) => (
                                            <Link
                                                key={cat.id}
                                                href={`/${locale}/products?category=${cat.slug}`}
                                                className="px-6 py-3 bg-white border-2 border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:border-[#7a3b2e] hover:text-[#7a3b2e] hover:bg-[#FFF5F3] transition-all duration-200"
                                            >
                                                {getCategoryName(cat, locale)}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Comments Section */}
                            <div className="mt-12 mb-12">
                                <div className="mb-8">
                                    <div className="flex items-center gap-2 align-middle">
                                        <h2 className="text-[16px] font-normal text-[#969696]">{text.comments}</h2>
                                        <div className="h-[30px] w-[30px] rounded-full bg-[#7a3b2e] flex items-center justify-center  text-[16px] font-normal text-white">{reviews.length}</div>
                                    </div>

                                </div>

                                {/* Comment Form */}
                                <form onSubmit={handleSubmit(onSubmitComment)} className="mb-6">
                                    <h3 className="font-semibold text-black mb-4">{text.writeComment}</h3>

                                    {/* Name Input */}
                                    <FormInput
                                        label={text.yourName}
                                        name="name"
                                        placeholder={text.namePlaceholder}
                                        register={register}
                                        error={errors.name}
                                        required
                                        className="mb-4"
                                    />

                                    {/* Rating Selector */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            {text.yourRating}
                                        </label>
                                        <div className="flex gap-2">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onClick={() => setSelectedRating(star)}
                                                    className="focus:outline-none"
                                                >
                                                    <svg
                                                        className={`w-8 h-8 ${star <= selectedRating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                                                    </svg>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Comment Textarea */}
                                    <FormTextarea
                                        label={text.comments}
                                        name="comment"
                                        placeholder={text.commentPlaceholder}
                                        register={register}
                                        error={errors.comment}
                                        required
                                        rows={4}
                                    />

                                    <button
                                        type="submit"
                                        disabled={submittingComment}
                                        className="mt-4 px-8 py-3 bg-[#7a3b2e] text-white rounded-lg hover:bg-[#6b2516] transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {submittingComment ? text.submittingComment : text.send}
                                    </button>
                                </form>

                                {/* Comments List */}
                                <div className="space-y-6">
                                    {reviews.length === 0 ? (
                                        <p className="text-center text-gray-500 py-8">No reviews yet. Be the first to review this product!</p>
                                    ) : (
                                        reviews.slice(0, visibleComments).map((review) => {
                                            const displayName = review.users?.name || review.user_name || 'Anonymous';
                                            const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                            const reviewDate = new Date(review.created_at).toLocaleDateString(locale, {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            });

                                            return (
                                                <div key={review.id} className=" pb-6">
                                                    <div className="flex gap-4">
                                                        <div className="">
                                                            {review.users?.avatar_url ? (
                                                                <Image
                                                                    src={review.users.avatar_url}
                                                                    alt={displayName}
                                                                    width={11}
                                                                    height={11}
                                                                    className="rounded-full h-11 w-11 object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-11 h-11 bg-[#7a3b2e] rounded-full flex items-center justify-center">
                                                                    <span className="text-white font-semibold">{initials}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div>
                                                                    <h4 className="font-normal text-[15px] text-black">{displayName}</h4>
                                                                    <span className="text-xs text-gray-500">{reviewDate}</span>
                                                                </div>
                                                                <div className="flex text-yellow-400 gap-2">
                                                                    {[...Array(5)].map((_, i) => (
                                                                        <svg
                                                                            key={i}
                                                                            className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'text-gray-300 fill-current'}`}
                                                                            viewBox="0 0 20 20"
                                                                        >

                                                                            <path d="M6.65394 1.58646C7.5321 -0.528821 10.4679 -0.52882 11.3461 1.58646L11.9577 3.05983C12.3174 3.9261 13.107 4.52663 14.0227 4.63041L15.7297 4.82385C17.8853 5.06813 18.7756 7.7755 17.2013 9.29884L15.752 10.7012C15.1148 11.3177 14.8333 12.2258 15.0069 13.1045L15.3568 14.8758C15.7997 17.118 13.3977 18.8109 11.5018 17.5927L10.3571 16.8572C9.52764 16.3242 8.47236 16.3242 7.64291 16.8572L6.49819 17.5927C4.60234 18.8109 2.20031 17.118 2.64323 14.8758L2.99315 13.1045C3.16673 12.2258 2.88518 11.3177 2.24798 10.7012L0.798712 9.29884C-0.775619 7.7755 0.114716 5.06813 2.27034 4.82385L3.97726 4.63041C4.89305 4.52663 5.68263 3.9261 6.04226 3.05983L6.65394 1.58646Z" />

                                                                        </svg>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <p className=" text-[12px] text-black mb-3">{review.comment}</p>
                                                            <div className="flex gap-4 text-sm items-center">
                                                                <button className=" h-9 w-30 border border-gray-200 rounded-[8px] text-[13px] font-normal text-black hover:text-[#7a3b2e] transition">
                                                                    {text.helpful}
                                                                </button>
                                                                <Divider type="vertical" style={{ height: 23 }} />
                                                                <button className="text-gray-500 hover:text-red-500 transition">
                                                                    {text.reportAbuse}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                                {reviews.length > visibleComments && (
                                    <div className="mt-4 flex justify-center">
                                        <button
                                            onClick={() => setVisibleComments(prev => prev + 5)}
                                            className="cursor-pointer text-black px-6 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                                        >
                                            See more comments
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>




                        {/* Right: Product Info */}
                        <div className="space-y-6">
                            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>

                            {/* Rating & Status */}
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <div className="flex text-yellow-400 gap-2">
                                        {[...Array(5)].map((_, i) => (
                                            <svg
                                                key={i}
                                                className={`w-5 h-5 ${i < Math.floor(averageRating)
                                                    ? 'fill-current'
                                                    : 'fill-gray-300'
                                                    }`}
                                                viewBox="0 0 20 20"
                                            >
                                                <path d="M6.65394 1.58646C7.5321 -0.528821 10.4679 -0.52882 11.3461 1.58646L11.9577 3.05983C12.3174 3.9261 13.107 4.52663 14.0227 4.63041L15.7297 4.82385C17.8853 5.06813 18.7756 7.7755 17.2013 9.29884L15.752 10.7012C15.1148 11.3177 14.8333 12.2258 15.0069 13.1045L15.3568 14.8758C15.7997 17.118 13.3977 18.8109 11.5018 17.5927L10.3571 16.8572C9.52764 16.3242 8.47236 16.3242 7.64291 16.8572L6.49819 17.5927C4.60234 18.8109 2.20031 17.118 2.64323 14.8758L2.99315 13.1045C3.16673 12.2258 2.88518 11.3177 2.24798 10.7012L0.798712 9.29884C-0.775619 7.7755 0.114716 5.06813 2.27034 4.82385L3.97726 4.63041C4.89305 4.52663 5.68263 3.9261 6.04226 3.05983L6.65394 1.58646Z" />
                                            </svg>
                                        ))}
                                    </div>
                                    <Link href="#reviews" className="text-sm text-[#7a3b2e] hover:underline">
                                        {reviewCount > 0 ? averageRating.toFixed(1) : '0.0'} ({reviewCount} {text.reviews})
                                    </Link>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">{text.status}:</span>
                                    <span className={`text-sm font-medium ${currentStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {currentStock > 0 ? text.inStock : text.outOfStock}
                                    </span>
                                </div>
                                {product.id && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        {product?.views}
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            {product.description && (
                                <p className="text-gray-600 leading-relaxed">{product.description}</p>
                            )}

                            {/* Price */}
                            <div className="flex items-baseline gap-3">
                                <span className="text-3xl font-bold text-gray-900">
                                    {Math.round(discountedPrice)} {product.currency || 'TND'}
                                </span>
                                {product.discount_percent && product.discount_percent > 0 && (
                                    <span className="text-xl text-gray-400 line-through">
                                        {Math.round(product.base_price)} {product.currency || 'TND'}
                                    </span>
                                )}
                            </div>

                            {/* Quantity */}
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-2">
                                    {text.quantity}
                                </label>
                                <div className="flex items-center gap-3 text-black">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        −
                                    </button>
                                    <div className="w-20 text-center border border-gray-300 rounded-lg py-2"
                                    >
                                        {quantity}
                                    </div>
                                    <button
                                        onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                                        className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        +
                                    </button>

                                </div>
                            </div>

                            {/* Color Selection */}
                            {availableColors.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-3">
                                        {text.selectColor}
                                    </label>
                                    <div className="flex gap-3 flex-wrap">
                                        {availableColors.map((color) => {
                                            const hexCode = color.hex_code || '#000000';
                                            const displayName = color.display_name || color.name;

                                            // Check if this color has any stock available
                                            const hasStock = product.product_variants?.some(v =>
                                                v.color_id === color.id &&
                                                v.stock > 0 &&
                                                (v.is_available !== false)
                                            );

                                            return (
                                                <div key={color.id} className="relative">
                                                    <button
                                                        onClick={() => handleColorSelect(color.id)}
                                                        className={`w-10 h-10 rounded-full border-2 transition relative ${selectedColor === color.id
                                                            ? 'border-[#7a3b2e] scale-110'
                                                            : 'border-gray-300'
                                                            } ${!hasStock ? 'opacity-40' : ''}`}
                                                        style={{ backgroundColor: hexCode }}
                                                        title={`${displayName}${!hasStock ? ' (Out of stock)' : ''}`}
                                                    >
                                                        {!hasStock && (
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <div className="w-12 h-0.5 bg-gray-600 rotate-45"></div>
                                                            </div>
                                                        )}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Size Selection */}
                            {availableSizes.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-3">
                                        {text.selectSize}
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {availableSizes.map((size) => {
                                            // Check if this size is available for selected color
                                            const isAvailable = !selectedColor ||
                                                (product.product_variants?.some(v =>
                                                    v.color_id === selectedColor &&
                                                    v.size_id === size.id &&
                                                    (v.is_available !== false)
                                                ));

                                            const displayName = size.code || size.name;

                                            return (
                                                <button
                                                    key={size.id}
                                                    onClick={() => handleSizeSelect(size.id)}
                                                    disabled={!isAvailable}
                                                    className={`px-6 py-2 border-2 rounded-lg font-medium transition ${selectedSize === size.id
                                                        ? 'border-[#7a3b2e] bg-[#7a3b2e] text-white'
                                                        : isAvailable
                                                            ? 'border-gray-300 hover:border-gray-400'
                                                            : 'border-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                                                        }`}
                                                >
                                                    {displayName}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Add to Cart */}
                            <AddToCartButton
                                product={{
                                    id: product.id,
                                    name: product.name,
                                    price: Math.round(discountedPrice),
                                    image: selectedVariant?.image_url || product.image_url || '',
                                    rating: averageRating,
                                    reviewCount: reviewCount
                                }}
                                quantity={quantity}
                                className="w-full py-4 text-lg"
                            />

                            {/* Expandable Sections */}
                            <div className="border-t pt-6 space-y-4">
                                {/* Product Details */}
                                <div className="border-b pb-4">
                                    <button
                                        onClick={() => toggleSection('product')}
                                        className="w-full flex items-center justify-between text-left"
                                    >
                                        <span className="font-semibold text-gray-900">{text.productDetails}</span>
                                        <svg
                                            className={`w-5 h-5 transition-transform ${expandedSection.includes('product') ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {
                                        expandedSection.includes('product')
                                        && (
                                            <div className="mt-4 space-y-2 text-sm text-gray-600">
                                                {product.weight && <p>• Weight: {product.weight}g</p>}
                                                {product.product_details?.map((detail, i) => (
                                                    <p key={i}>• {detail}</p>
                                                ))}
                                                {(!product.product_details || product.product_details.length === 0) && (
                                                    <>
                                                        <p>• 100% authentic handmade</p>
                                                        <p>• Premium quality materials</p>
                                                        <p>• Traditional craftsmanship</p>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                </div>

                                {/* Shipping Details */}
                                <div className="border-b pb-4">
                                    <button
                                        onClick={() => toggleSection('shipping')}
                                        className="w-full flex items-center justify-between text-left"
                                    >
                                        <span className="font-semibold text-gray-900">{text.shippingDetails}</span>
                                        <svg
                                            className={`w-5 h-5 transition-transform ${expandedSection.includes('shipping')
                                                ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {expandedSection.includes('shipping') && (
                                        <div className="mt-4 space-y-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-600">{text.homeDelivery}</span>
                                                <span className="text-gray-600 font-medium">{text.deliveryCost}:{headerConfig.invoices.default_shipping_cost} TND</span>
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                {product.shipping_info || `Free shipping on orders over ${headerConfig.invoices.free_shipping_threshold} TND. Delivery within 1-3 business days.`}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Seller Details */}
                                <div className="pb-4 ">
                                    <button
                                        onClick={() => toggleSection('seller')}
                                        className=" w-full flex items-center justify-between text-left"
                                    >
                                        <span className="text-[16px] font-medium text-[#969696]">{text.sellerDetails}</span>
                                        <svg
                                            className={`w-5 h-5 transition-transform ${expandedSection.includes('seller')
                                                ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {
                                        expandedSection.includes('seller')
                                        && (
                                            <div>
                                                <div className="mb-10 flex gap-2 mt-4 text-sm text-gray-600 border  p-4 rounded-[12px] border-[#E8E8E8]">

                                                    <div className="flex text-center gap-2 align-center h-12 w-12">
                                                        <Image src="/assets/images/logoKachabity.jpg" alt="logo" width={40} height={40} />
                                                    </div>

                                                    <div className="flex flex-col gap-3">
                                                        <h1 className="color-black font-semibold">Kachabity</h1>
                                                        <h3 className="text-[#A1A1A1]">The Seller Contact:</h3>
                                                        <div className=" flex flex-col gap-4">
                                                            <div className="flex text-center gap-2">
                                                                <svg width="21" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                    <path d="M2.55225 4.2504L8.33247 8.38004C9.47954 9.19955 11.0205 9.19955 12.1675 8.38004L17.9477 4.2504M1.13539 12.9013C0.621536 10.8319 0.621536 8.66815 1.13539 6.59875C1.80805 3.88984 3.95602 1.79534 6.68056 1.19162L7.13443 1.09105C9.1866 0.636317 11.3134 0.636318 13.3656 1.09105L13.8194 1.19162C16.544 1.79534 18.692 3.88984 19.3646 6.59876C19.8785 8.66815 19.8785 10.8319 19.3646 12.9012C18.692 15.6102 16.544 17.7047 13.8194 18.3084L13.3656 18.409C11.3134 18.8637 9.1866 18.8637 7.13443 18.409L6.68055 18.3084C3.95601 17.7047 1.80805 15.6102 1.13539 12.9013Z" stroke="#842E1B" strokeWidth="1.5" strokeLinecap="round" />
                                                                </svg>
                                                                <span> {headerConfig.contact.email}</span>

                                                            </div>
                                                            <div className="flex text-center gap-2">
                                                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                    <path d="M12.9153 18.6335C13.7969 18.7888 14.7031 18.7888 15.5847 18.6335C17.0016 18.3838 18.1429 17.4326 18.536 16.1736L18.6194 15.9065C18.706 15.629 18.75 15.3419 18.75 15.0534C18.75 13.7813 17.6123 12.75 16.2089 12.75H12.2911C10.8877 12.75 9.75 13.7813 9.75 15.0534C9.75 15.3419 9.79396 15.629 9.88063 15.9065L9.96402 16.1736C10.3571 17.4326 11.4984 18.3838 12.9153 18.6335ZM12.9153 18.6335C6.79195 17.4989 2.00108 12.708 0.866503 6.58468M0.866503 6.58468C0.711165 5.70315 0.711166 4.79686 0.866504 3.91532C1.11618 2.49842 2.06744 1.35713 3.32641 0.964017L3.59345 0.880631C3.87103 0.793959 4.15813 0.75 4.44661 0.75C5.71874 0.75 6.75001 1.88768 6.75 3.29106L6.75 7.20894C6.75001 8.61233 5.71874 9.75 4.44661 9.75C4.15813 9.75 3.87103 9.70604 3.59345 9.61937L3.32641 9.53598C2.06744 9.14287 1.11618 8.00159 0.866503 6.58468Z" stroke="#842E1B" strokeWidth="1.5" />
                                                                </svg>

                                                                <span> {headerConfig.contact.phone}</span>
                                                            </div>
                                                            <div className="flex text-center gap-2">
                                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                    <path d="M20 11.1755C20 15.6907 16.4183 21 12 21C7.58172 21 4 15.6907 4 11.1755C4 6.66029 7.58172 3 12 3C16.4183 3 20 6.66029 20 11.1755Z" stroke="#842E1B" strokeWidth="1.5" />
                                                                    <path d="M9.5 10.5C9.5 9.11929 10.6193 8 12 8C13.3807 8 14.5 9.11929 14.5 10.5C14.5 11.8807 13.3807 13 12 13C10.6193 13 9.5 11.8807 9.5 10.5Z" stroke="#842E1B" strokeWidth="1.5" />
                                                                </svg>

                                                                <span> {headerConfig.contact.address}</span>
                                                            </div>

                                                        </div>
                                                    </div>

                                                </div>
                                                <div className="cursor-pointer block w-full py-4 border border-[#7a3b2e] text-[#7a3b2e] text-center rounded-lg hover:bg-gray-50 transition font-medium text-lg">Call Kachabity Now</div>

                                            </div>

                                        )}
                                    <div className="z-9 absolute right-0 top-390 w-64 h-64  pointer-events-none">
                                        <Image
                                            src="/assets/images/flowerFloated.svg"
                                            alt="Decorative flower"
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
            <Footer />
        </>
    );
}

