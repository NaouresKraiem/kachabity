"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import StaticHeader from "@/components/layout/StaticHeader";
import Footer from "@/components/footer/Footer";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ProductListCard from "@/components/products/ProductListCard";
import { Skeleton, Card, message } from "antd";
import { useCart } from "@/lib/cart-context";
import { toggleFavorite, getUserFavorites } from "@/lib/favorites";

interface Product {
    id: string;
    name: string;
    name_ar?: string;
    name_fr?: string;
    slug: string;
    description?: string;
    base_price: number;
    currency?: string;
    discount_percent?: number;
    image_url?: string;
    stock: number;
    rating?: number;
    review_count?: number;
    category_id?: string;
    colors?: string[];
    sizes?: string[];
    product_images?: Array<{
        id: string;
        image_url: string;
        alt_text?: string;
        is_main: boolean;
        position: number;
    }>;
}

interface Category {
    id: string;
    name: string;
    slug: string;
    name_ar?: string;
    name_fr?: string;
    image_url?: string;
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

const content = {
    en: {
        loading: "Loading products...",
        noProducts: "No products found in this category",
        showingResults: "Showing {count} products",
        addToCart: "Add",
        pleaseLogin: "Please login to save favorites",
        previous: "Previous",
        next: "Next",
        backToCategories: "← Back to Categories"
    },
    fr: {
        loading: "Chargement des produits...",
        noProducts: "Aucun produit trouvé dans cette catégorie",
        showingResults: "Affichage de {count} produits",
        addToCart: "Ajouter",
        pleaseLogin: "Veuillez vous connecter pour enregistrer vos favoris",
        previous: "Précédent",
        next: "Suivant",
        backToCategories: "← Retour aux catégories"
    },
    ar: {
        loading: "جاري تحميل المنتجات...",
        noProducts: "لم يتم العثور على منتجات في هذه الفئة",
        showingResults: "عرض {count} منتجات",
        addToCart: "أضف",
        pleaseLogin: "يرجى تسجيل الدخول لحفظ المفضلة",
        previous: "السابق",
        next: "التالي",
        backToCategories: "← العودة إلى الفئات"
    }
};

export default function CategoryProductsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const locale = (params.locale as string) || 'en';
    const categorySlug = params.slug as string;
    const text = content[locale as keyof typeof content] || content.en;

    const [products, setProducts] = useState<Product[]>([]);
    const [category, setCategory] = useState<Category | null>(null);
    const { addItem } = useCart();
    const [loading, setLoading] = useState(true);
    const [productsLoading, setProductsLoading] = useState(false);
    const [wishlist, setWishlist] = useState<Set<string>>(new Set());
    const [userId, setUserId] = useState<string | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const ITEMS_PER_PAGE = 20;

    // Fetch authenticated user and their favorites
    useEffect(() => {
        async function fetchUserAndFavorites() {
            try {
                const { data } = await supabase.auth.getUser();
                if (data.user) {
                    setUserId(data.user.id);

                    // Fetch user's favorites
                    const { favorites } = await getUserFavorites(data.user.id);
                    const favoriteIds = new Set(favorites.map(fav => fav.product_id));
                    setWishlist(favoriteIds);
                }
            } catch (error) {
                console.error("Error fetching user favorites:", error);
            }
        }

        fetchUserAndFavorites();
    }, []);

    // Fetch category by slug
    useEffect(() => {
        async function fetchCategory() {
            try {
                const { data, error } = await supabase
                    .from('categories')
                    .select('*')
                    .eq('slug', categorySlug)
                    .single();

                if (error) throw error;
                if (data) {
                    setCategory(data);
                }
            } catch (error) {
                console.error('Error fetching category:', error);
            }
        }

        if (categorySlug) {
            fetchCategory();
        }
    }, [categorySlug]);

    // Fetch products for this category
    async function fetchProducts() {
        if (!category) return;

        try {
            setProductsLoading(true);

            let query = supabase
                .from('products')
                .select(`
                    *,
                    product_images (
                        id,
                        image_url,
                        alt_text,
                        is_main,
                        position
                    )
                `, { count: 'exact' })
                .eq('category_id', category.id)
                .is('deleted_at', null)
                .eq('status', 'active');

            // Apply pagination
            const from = (currentPage - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;
            query = query.range(from, to);

            // Order by created_at descending
            query = query.order('created_at', { ascending: false });

            // Execute query
            const { data, error, count } = await query;

            if (error) throw error;
            if (data) {
                setProducts(data);
                setTotalCount(count || 0);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setProductsLoading(false);
            setLoading(false);
        }
    }

    useEffect(() => {
        if (category) {
            setCurrentPage(1);
            fetchProducts();
        }
    }, [category]);

    // Refetch when page changes
    useEffect(() => {
        if (category) {
            fetchProducts();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage]);

    const toggleWishlist = async (productId: string) => {
        if (!userId) {
            message.error(text.pleaseLogin);
            return;
        }

        // Optimistically update UI
        setWishlist(prev => {
            const newSet = new Set(prev);
            if (newSet.has(productId)) {
                newSet.delete(productId);
            } else {
                newSet.add(productId);
            }
            return newSet;
        });

        // Persist to database
        try {
            const { isFavorited, error } = await toggleFavorite(userId, productId);

            if (error) {
                console.error("Error toggling favorite:", error);
                // Revert optimistic update on error
                setWishlist(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(productId)) {
                        newSet.delete(productId);
                    } else {
                        newSet.add(productId);
                    }
                    return newSet;
                });
            }
        } catch (error) {
            console.error("Error in toggleWishlist:", error);
        }
    };

    if (loading || !category) {
        return (
            <>
                <StaticHeader />
                <LoadingSpinner message={text.loading} />
                <Footer />
            </>
        );
    }

    return (
        <>
            <StaticHeader />
            <div className="min-h-screen bg-white py-8">
                <div className="max-w-7xl mx-auto px-4">
                    {/* Back Button and Category Header */}
                    <div className="mb-8">
                        <a
                            href={`/${locale}/categories`}
                            className="inline-flex items-center text-[#7a3b2e] hover:text-[#842E1B] mb-4 transition"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            {text.backToCategories}
                        </a>
                        <h1 className="text-4xl font-bold text-[#2b1a16] mb-2">
                            {getCategoryName(category, locale)}
                        </h1>
                        {!productsLoading && (
                            <p className="text-gray-600">
                                {text.showingResults.replace('{count}', products.length.toString())}
                            </p>
                        )}
                    </div>

                    {/* Products Grid */}
                    {productsLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
                                <Card
                                    key={index}
                                    hoverable
                                    cover={
                                        <Skeleton.Image
                                            active
                                            style={{
                                                width: '100%',
                                                height: '280px',
                                                aspectRatio: '1/1'
                                            }}
                                        />
                                    }
                                    className="overflow-hidden"
                                >
                                    <Skeleton active paragraph={{ rows: 3 }} />
                                </Card>
                            ))}
                        </div>
                    ) : products.length === 0 ? (
                        <div className="text-center py-16">
                            <svg className="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">{text.noProducts}</h3>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-4">
                                {products.map(product => (
                                    <ProductListCard
                                        key={product.id}
                                        product={product as any}
                                        locale={locale}
                                        isFavorite={wishlist.has(product.id)}
                                        onToggleFavorite={toggleWishlist}
                                        onAddToCart={(p) => {
                                            // Get product image from product_images or fallback
                                            const productImage = p.product_images && p.product_images.length > 0
                                                ? (p.product_images.find(img => img.is_main)?.image_url || p.product_images[0].image_url)
                                                : (p.image_url || '');

                                            // Calculate discounted price
                                            const price = p.discount_percent
                                                ? p.base_price * (1 - p.discount_percent / 100)
                                                : p.base_price;

                                            addItem({
                                                id: p.id,
                                                name: p.name,
                                                price: Math.round(price),
                                                image: productImage,
                                                reviewCount: p.review_count || 0
                                            });
                                        }}
                                    />
                                ))}
                            </div>

                            {/* Pagination */}
                            {!productsLoading && totalCount > ITEMS_PER_PAGE && (
                                <div className="mt-12 flex items-center justify-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        {text.previous}
                                    </button>

                                    <div className="flex gap-1">
                                        {Array.from({ length: Math.ceil(totalCount / ITEMS_PER_PAGE) }, (_, i) => i + 1)
                                            .filter(page => {
                                                const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
                                                return page === 1 ||
                                                    page === totalPages ||
                                                    Math.abs(page - currentPage) <= 1;
                                            })
                                            .map((page, index, array) => {
                                                const showEllipsisBefore = index > 0 && array[index - 1] < page - 1;
                                                return (
                                                    <div key={page} className="flex items-center gap-1">
                                                        {showEllipsisBefore && <span className="px-2">...</span>}
                                                        <button
                                                            onClick={() => setCurrentPage(page)}
                                                            className={`w-10 h-10 rounded-lg transition ${currentPage === page
                                                                ? 'bg-[#842E1B] text-white'
                                                                : 'border border-gray-300 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            {page}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                    </div>

                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / ITEMS_PER_PAGE), prev + 1))}
                                        disabled={currentPage >= Math.ceil(totalCount / ITEMS_PER_PAGE)}
                                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        {text.next}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            <Footer />
        </>
    );
}

