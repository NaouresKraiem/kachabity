"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import StaticHeader from "@/components/layout/StaticHeader";
import Footer from "@/components/footer/Footer";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ProductListCard from "@/components/products/ProductListCard";
import { Skeleton, Card } from "antd";
import { useCart } from "@/lib/cart-context";
import { toggleFavorite, getUserFavorites } from "@/lib/favorites";

interface Product {
    id: string;
    title: string;
    title_ar?: string;
    title_fr?: string;
    slug: string;
    description?: string;
    price_cents: number;
    currency: string;
    discount_percent?: number;
    image_url: string;
    stock: number;
    rating?: number;
    review_count?: number;
    category_id?: string;
    colors?: string[];
    sizes?: string[];
}

interface Category {
    id: string;
    name: string;
    slug: string;
    name_ar?: string;
    name_fr?: string;
}

const content = {
    en: {
        filter: "Filter",
        price: "Price",
        size: "Size",
        color: "Color",
        category: "Category",
        reviews: "reviews",
        addToCart: "Add",
        discount: "Discount",
        noProducts: "No products found",
        showingResults: "Showing {count} products",
        applyFilters: "Filter"
    },
    fr: {
        filter: "Filtrer",
        price: "Prix",
        size: "Taille",
        color: "Couleur",
        category: "Catégorie",
        reviews: "avis",
        addToCart: "Ajouter",
        discount: "Réduction",
        noProducts: "Aucun produit trouvé",
        showingResults: "Affichage de {count} produits",
        applyFilters: "Filtrer"
    },
    ar: {
        filter: "تصفية",
        price: "السعر",
        size: "المقاس",
        color: "اللون",
        category: "الفئة",
        reviews: "تقييم",
        addToCart: "أضف",
        discount: "خصم",
        noProducts: "لم يتم العثور على منتجات",
        showingResults: "عرض {count} منتجات",
        applyFilters: "تصفية"
    }
};

// Predefined colors for filter
const FILTER_COLORS = [
    { name: "Gold", value: "#D4AF37" },
    { name: "Teal", value: "#2F4F4F" },
    { name: "Beige", value: "#DEB887" },
    { name: "Purple", value: "#9370DB" }
];

const SIZES = ["S", "M", "L", "XL", "XXL", "XXXL", "4XL"];

export default function ProductsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const locale = (params.locale as string) || 'en';
    const text = content[locale as keyof typeof content] || content.en;

    const [products, setProducts] = useState<Product[]>([]);
    const { addItem } = useCart();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [productsLoading, setProductsLoading] = useState(false); // Separate loading for products
    const [wishlist, setWishlist] = useState<Set<string>>(new Set());
    const [categoryMap, setCategoryMap] = useState<Map<string, string>>(new Map());
    const [userId, setUserId] = useState<string | null>(null);

    // Filter states
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
    const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
    const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const ITEMS_PER_PAGE = 20;

    // Get category from URL if present
    const urlCategory = searchParams.get('category');
    const promoOnly = searchParams.get('promo');
    const search = searchParams?.get('search') || "";

    // Initialize: Fetch categories and user favorites
    useEffect(() => {
        fetchCategories();
        fetchUserAndFavorites();
    }, []);

    // Fetch authenticated user and their favorites
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

    // Handle URL category parameter and set selected category
    useEffect(() => {
        if (categories.length > 0 && urlCategory) {
            // Find category ID from slug
            const category = categories.find(cat => cat.slug === urlCategory);
            if (category) {
                setSelectedCategoryIds(new Set([category.id]));
            }
        }
    }, [urlCategory, categories]);

    async function fetchCategories() {
        try {
            const { data, error } = await supabase
                .from('categories')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) throw error;
            if (data) {
                setCategories(data);
                // Create a map of category_id -> slug for easy lookup
                const map = new Map<string, string>(data.map((cat: Category) => [cat.id, cat.slug]));
                setCategoryMap(map);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    }

    async function fetchProducts() {
        try {
            setProductsLoading(true);

            // Build query with filters applied at database level
            let query = supabase
                .from('products')
                .select('*', { count: 'exact' })


            if (search) {
                query = query.ilike('title', `%${search}%`);
            }


            // query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%`);

            // Apply price range filter
            if (priceRange[0] > 0) {
                query = query.gte('price_cents', priceRange[0]);
            }
            if (priceRange[1] < 1000) {
                query = query.lte('price_cents', priceRange[1]);
            }

            // Apply category filter
            if (selectedCategoryIds.size > 0) {
                query = query.in('category_id', Array.from(selectedCategoryIds));
            }

            // Apply size filter (if sizes column exists as array in DB)
            if (selectedSizes.size > 0) {
                // This assumes 'sizes' is a JSONB array column
                // For each selected size, we check if it's contained in the array
                const sizesArray = Array.from(selectedSizes);
                query = query.overlaps('sizes', sizesArray);
            }

            // Apply color filter (if colors column exists as array in DB)
            if (selectedColors.size > 0) {
                // This assumes 'colors' is a JSONB array column
                const colorsArray = Array.from(selectedColors);
                query = query.overlaps('colors', colorsArray);
            }

            // Apply promo filter from URL (?promo=true)
            if (promoOnly) {
                query = query.not('discount_percent', 'is', null).gt('discount_percent', 0);
            }

            // Order by newest first
            query = query.order('created_at', { ascending: false });

            // Apply pagination
            const from = (currentPage - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;
            query = query.range(from, to);

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
            setLoading(false); // Initial page load complete
        }
    }

    // Fetch products initially and when filters change
    useEffect(() => {
        // Only fetch if categories have been loaded
        if (categories.length > 0) {
            // Reset to page 1 when filters change
            setCurrentPage(1);
            fetchProducts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [priceRange, selectedSizes, selectedColors, selectedCategoryIds, categories.length]);




    const toggleWishlist = async (productId: string) => {
        // If user not logged in, show message or redirect
        if (!userId) {
            alert("Please login to save favorites");
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

    const toggleSize = (size: string) => {
        setSelectedSizes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(size)) {
                newSet.delete(size);
            } else {
                newSet.add(size);
            }
            return newSet;
        });
    };

    const toggleColor = (color: string) => {
        setSelectedColors(prev => {
            const newSet = new Set(prev);
            if (newSet.has(color)) {
                newSet.delete(color);
            } else {
                newSet.add(color);
            }
            return newSet;
        });
    };

    const toggleCategory = (categoryId: string) => {
        setSelectedCategoryIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryId)) {
                newSet.delete(categoryId);
            } else {
                newSet.add(categoryId);
            }
            return newSet;
        });
    };
    // Refetch when page changes
    useEffect(() => {
        fetchProducts();
        // Scroll to top when page changes
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, promoOnly, search])    // 👈 added


    if (loading) {
        return <LoadingSpinner message="Loading products..." />;
    }

    return (
        <>
            <StaticHeader />
            <div className="min-h-screen bg-white py-8">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="grid lg:grid-cols-4 gap-8">
                        {/* Left Sidebar - Filters */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-lg p-6 border border-gray-200 sticky top-4">
                                <h2 className="text-xl font-bold text-gray-900 mb-6">{text.filter}</h2>

                                {/* Price Range */}
                                <div className="mb-8">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-medium text-gray-900">{text.price}</span>
                                        <button className="text-gray-400 hover:text-gray-600">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1000"
                                        value={priceRange[1]}
                                        onChange={(e) => setPriceRange([0, parseInt(e.target.value)])}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#842E1B]"
                                    />
                                    <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
                                        <span>{priceRange[0]}</span>
                                        <span>{priceRange[1]}</span>
                                    </div>
                                </div>

                                {/* Size Filter */}
                                <div className="mb-8">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-medium text-gray-900">{text.size}</span>
                                        <button className="text-gray-400 hover:text-gray-600">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {SIZES.map(size => (
                                            <button
                                                key={size}
                                                onClick={() => toggleSize(size)}
                                                className={`px-3 py-2 text-sm font-medium border rounded-lg transition ${selectedSizes.has(size)
                                                    ? 'bg-[#842E1B] text-white border-[#842E1B]'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                                                    }`}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Color Filter */}
                                <div className="mb-8">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-medium text-gray-900">{text.color}</span>
                                        <button className="text-gray-400 hover:text-gray-600">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="flex gap-3">
                                        {FILTER_COLORS.map(color => (
                                            <button
                                                key={color.value}
                                                onClick={() => toggleColor(color.value)}
                                                className={`w-10 h-10 rounded-full border-2 transition ${selectedColors.has(color.value)
                                                    ? 'border-[#842E1B] scale-110'
                                                    : 'border-gray-300'
                                                    }`}
                                                style={{ backgroundColor: color.value }}
                                                title={color.name}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Category Filter */}
                                <div className="mb-8">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-medium text-gray-900">{text.category}</span>
                                        <button className="text-gray-400 hover:text-gray-600">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {categories.map(category => (
                                            <label key={category.id} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCategoryIds.has(category.id)}
                                                    onChange={() => toggleCategory(category.id)}
                                                    className="w-4 h-4 text-[#842E1B] border-gray-300 rounded focus:ring-[#842E1B]"
                                                />
                                                <span className="text-sm text-gray-700">{category.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Filter Button */}
                                <button
                                    onClick={() => {
                                        // Filters are applied automatically via state
                                    }}
                                    className="w-full py-3 bg-[#842E1B] text-white rounded-lg hover:bg-[#6b2516] transition font-medium"
                                >
                                    {text.applyFilters}
                                </button>
                            </div>
                        </div>

                        {/* Right Side - Product Grid */}
                        <div className="lg:col-span-3">
                            {/* Results Count */}
                            {!productsLoading && (
                                <div className="mb-6">
                                    <p className="text-sm text-gray-600">
                                        {text.showingResults.replace('{count}', products.length.toString())}
                                    </p>
                                </div>
                            )}

                            {/* Loading Skeleton */}
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
                                    <p className="text-gray-600">Try adjusting your filters</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 pb-4">
                                    {products.map(product => {
                                        return (
                                            <ProductListCard
                                                key={product.id}
                                                product={product as any}
                                                locale={locale}
                                                isFavorite={wishlist.has(product.id)}
                                                onToggleFavorite={toggleWishlist}
                                                onAddToCart={(p) => addItem({
                                                    id: p.id,
                                                    name: p.title,
                                                    price: p.price_cents,
                                                    image: p.image_url,
                                                    reviewCount: p.review_count
                                                })}
                                            />
                                        );
                                    })}
                                </div>
                            )}

                            {/* Pagination */}
                            {!productsLoading && totalCount > ITEMS_PER_PAGE && (
                                <div className="mt-12 flex items-center justify-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        Previous
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
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
}

