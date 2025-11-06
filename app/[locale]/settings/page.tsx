"use client";

import { use } from "react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useForm } from "react-hook-form";
import { message } from "antd";
import supabase from "@/lib/supabaseClient";
import { Order as OrderType } from "@/lib/orders";
import { getUserFavorites, removeFromFavorites, FavoriteWithProduct } from "@/lib/favorites";
import ProductListCard from "@/components/products/ProductListCard";
import { useCart } from "@/lib/cart-context";
import { FormInput } from "@/components/forms";

type Locale = "en" | "fr" | "ar";

type OrderItem = {
  id: string;
  order_id: string;
  product_name: string;
  product_image: string;
  quantity: number;
  price: number;
  subtotal: number;
};

type OrderWithItems = OrderType & {
  items: OrderItem[];
};

type UserProfile = {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
};

type ProfileFormData = {
  full_name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  address: string;
};

type PasswordFormData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const content: Record<Locale, {
  pageTitle: string;
  pageSubtitle: string;
  tabs: { id: string; label: string; }[];
  myOrders: string;
  orderDate: string;
  orderNo: string;
  payment: string;
  shippingAddress: string;
  quantity: string;
  status: string;
  accountInfo: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  saveChanges: string;
  cancel: string;
  security: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  changePassword: string;
  savedItems: string;
  noSavedItems: string;
  removeFromSaved: string;
  noOrders: string;
}> = {
  en: {
    pageTitle: "Settings",
    pageSubtitle: "Manage your account settings and preferences",
    tabs: [
      { id: "orders", label: "My Orders" },
      { id: "account", label: "Account Information" },
      { id: "security", label: "Security" },
      { id: "saved", label: "Saved Items" },
      { id: "logout", label: "Logout" }
    ],
    myOrders: "My Orders",
    orderDate: "Order Date",
    orderNo: "Order No",
    payment: "Payment",
    shippingAddress: "Shipping Address",
    quantity: "Quantity",
    status: "Status",
    accountInfo: "Account Information",
    fullName: "Full Name",
    email: "Email Address",
    phone: "Phone Number",
    address: "Address",
    city: "City",
    country: "Country",
    saveChanges: "Save Changes",
    cancel: "Cancel",
    security: "Security Settings",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmPassword: "Confirm New Password",
    changePassword: "Change Password",
    savedItems: "Saved Items",
    noSavedItems: "No saved items yet",
    removeFromSaved: "Remove",
    noOrders: "No orders yet"
  },
  fr: {
    pageTitle: "Paramètres",
    pageSubtitle: "Gérez les paramètres et préférences de votre compte",
    tabs: [
      { id: "orders", label: "Mes commandes" },
      { id: "account", label: "Informations du compte" },
      { id: "security", label: "Sécurité" },
      { id: "saved", label: "Articles enregistrés" },
      { id: "logout", label: "Déconnexion" }
    ],
    myOrders: "Mes commandes",
    orderDate: "Date de commande",
    orderNo: "N° commande",
    payment: "Paiement",
    shippingAddress: "Adresse de livraison",
    quantity: "Quantité",
    status: "Statut",
    accountInfo: "Informations du compte",
    fullName: "Nom complet",
    email: "Adresse e-mail",
    phone: "Numéro de téléphone",
    address: "Adresse",
    city: "Ville",
    country: "Pays",
    saveChanges: "Enregistrer les modifications",
    cancel: "Annuler",
    security: "Paramètres de sécurité",
    currentPassword: "Mot de passe actuel",
    newPassword: "Nouveau mot de passe",
    confirmPassword: "Confirmer le nouveau mot de passe",
    changePassword: "Changer le mot de passe",
    savedItems: "Articles enregistrés",
    noSavedItems: "Aucun article enregistré",
    removeFromSaved: "Retirer",
    noOrders: "Aucune commande"
  },
  ar: {
    pageTitle: "الإعدادات",
    pageSubtitle: "إدارة إعدادات وتفضيلات حسابك",
    tabs: [
      { id: "orders", label: "طلباتي" },
      { id: "account", label: "معلومات الحساب" },
      { id: "security", label: "الأمان" },
      { id: "saved", label: "العناصر المحفوظة" },
      { id: "logout", label: "تسجيل الخروج" }
    ],
    myOrders: "طلباتي",
    orderDate: "تاريخ الطلب",
    orderNo: "رقم الطلب",
    payment: "الدفع",
    shippingAddress: "عنوان الشحن",
    quantity: "الكمية",
    status: "الحالة",
    accountInfo: "معلومات الحساب",
    fullName: "الاسم الكامل",
    email: "عنوان البريد الإلكتروني",
    phone: "رقم الهاتف",
    address: "العنوان",
    city: "المدينة",
    country: "البلد",
    saveChanges: "حفظ التغييرات",
    cancel: "إلغاء",
    security: "إعدادات الأمان",
    currentPassword: "كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور الجديدة",
    changePassword: "تغيير كلمة المرور",
    savedItems: "العناصر المحفوظة",
    noSavedItems: "لا توجد عناصر محفوظة بعد",
    removeFromSaved: "إزالة",
    noOrders: "لا توجد طلبات بعد"
  }
};

export default function SettingsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale: rawLocale } = use(params);
  const locale: Locale = ["en", "fr", "ar"].includes(rawLocale as string) ? (rawLocale as Locale) : "en";
  const text = content[locale];
  const router = useRouter();
  const pathname = usePathname();
  const { addItem } = useCart();

  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [savedItems, setSavedItems] = useState<FavoriteWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  // React Hook Form for profile
  const profileForm = useForm<ProfileFormData>({
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      country: "",
      city: "",
      address: "",
    },
  });

  // React Hook Form for password
  const passwordForm = useForm<PasswordFormData>({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Fetch user orders
  const fetchOrders = async (userId: string) => {
    setOrdersLoading(true);
    try {
      // Fetch orders for the current user
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        setOrdersLoading(false);
        return;
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setOrdersLoading(false);
        return;
      }

      // Fetch order items for all orders
      const orderIds = ordersData.map((order: OrderType) => order.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);

      if (itemsError) {
        console.error("Error fetching order items:", itemsError);
      }

      // Combine orders with their items
      const ordersWithItems: OrderWithItems[] = ordersData.map((order: OrderType) => ({
        ...order,
        items: itemsData?.filter((item: OrderItem) => item.order_id === order.id) || [],
      }));

      setOrders(ordersWithItems);
    } catch (error) {
      console.error("Error in fetchOrders:", error);
    } finally {
      setOrdersLoading(false);
    }
  };

  // Fetch user favorites
  const fetchFavorites = async (userId: string) => {
    setFavoritesLoading(true);
    try {
      const { favorites, error } = await getUserFavorites(userId);

      if (error) {
        console.error("Error fetching favorites:", error);
      } else {
        setSavedItems(favorites);
      }
    } catch (error) {
      console.error("Error in fetchFavorites:", error);
    } finally {
      setFavoritesLoading(false);
    }
  };

  // Handle remove from favorites
  const handleRemoveFavorite = async (productId: string) => {
    if (!userProfile) return;

    const { success, error } = await removeFromFavorites(userProfile.id, productId);

    if (success) {
      // Remove from local state
      setSavedItems(prev => prev.filter(item => item.product_id !== productId));
      message.success("Item removed from saved items");
    } else {
      console.error("Error removing favorite:", error);
      message.error("Failed to remove item from saved. Please try again.");
    }
  };

  // Authentication check
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!data.user) {
        router.replace(`/${locale}/auth?redirect=${encodeURIComponent(pathname)}`);
      } else {
        setAuthChecked(true);
        const profile = {
          id: data.user.id,
          email: data.user.email || "",
          full_name: data.user.user_metadata?.first_name
            + " " + data.user.user_metadata?.last_name || "",
          phone: data.user.user_metadata?.phone || "",
          address: data.user.user_metadata?.address || "",
          city: data.user.user_metadata?.city || "",
          country: data.user.user_metadata?.country || ""
        };
        setUserProfile(profile);

        // Populate profile form
        profileForm.reset({
          full_name: profile.full_name || "",
          email: profile.email,
          phone: profile.phone || "",
          country: profile.country || "",
          city: profile.city || "",
          address: profile.address || "",
        });

        setLoading(false);

        // Fetch orders and favorites
        fetchOrders(data.user.id);
        fetchFavorites(data.user.id);
      }
    })();
    return () => { mounted = false; };
  }, [router, pathname, locale, profileForm]);

  // Handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push(`/${locale}/auth`);
  };

  // Handle tab click
  const handleTabClick = (tabId: string) => {
    if (tabId === "logout") {
      handleLogout();
    } else {
      setActiveTab(tabId);
    }
  };

  // Handle password change
  const handlePasswordChange = async (data: PasswordFormData) => {
    if (data.newPassword !== data.confirmPassword) {
      message.error("Passwords don't match!");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: data.newPassword
    });

    if (error) {
      message.error("Error changing password: " + error.message);
    } else {
      message.success("Password changed successfully!");
      passwordForm.reset();
    }
  };

  // Handle profile update
  const handleProfileUpdate = async (data: ProfileFormData) => {
    if (!userProfile) return;

    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: data.full_name,
        phone: data.phone,
        address: data.address,
        city: data.city,
        country: data.country
      }
    });

    if (error) {
      message.error("Error updating profile: " + error.message);
    } else {
      message.success("Profile updated successfully!");
      // Update local state
      setUserProfile({
        ...userProfile,
        full_name: data.full_name,
        phone: data.phone,
        address: data.address,
        city: data.city,
        country: data.country
      });
    }
  };

  if (!authChecked || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-600">
        Checking authentication...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white">

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-semibold text-[#2b1a16]">{text.pageTitle}</h1>
        <p className="text-sm text-gray-600 mt-2">{text.pageSubtitle}</p>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <ul className="space-y-2">
                {text.tabs.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => handleTabClick(t.id)}
                      className={`cursor-pointer w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${activeTab === t.id
                        ? 'bg-[#F6EDEA] text-[#7a3b2e] font-medium'
                        : 'hover:bg-gray-50 text-gray-700'
                        }`}
                    >
                      {t.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Content */}
          <section className="lg:col-span-3">
            {/* Orders Tab */}
            {activeTab === "orders" && (
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 font-medium text-gray-900">
                  {text.myOrders}
                </div>

                {ordersLoading ? (
                  <div className="p-6 text-center text-gray-500">
                    Loading orders...
                  </div>
                ) : orders.length === 0 ? (
                  <div className="p-6">
                    <div className="text-center text-gray-500 py-12">
                      {text.noOrders}
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {orders.map((order) => (
                      <div key={order.id} className="p-6">
                        {/* Order Header */}
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="font-medium text-gray-900">
                              {text.orderNo}: {order.order_number}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {text.orderDate}: {new Date(order.created_at).toLocaleDateString(locale)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-[#7a3b2e] text-lg">
                              {order.total.toFixed(2)} TND
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {text.status}: <span className="font-medium">{order.status}</span>
                            </div>
                          </div>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-3">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-4">
                              <div className="relative w-20 h-20 rounded-md overflow-hidden border border-gray-200 shrink-0">
                                <Image
                                  src={item.product_image || "/assets/images/logoKachabity.jpg"}
                                  alt={item.product_name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">
                                  {item.product_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {text.quantity}: {item.quantity} × {item.price.toFixed(2)} TND
                                </div>
                              </div>
                              <div className="font-medium text-gray-900">
                                {item.subtotal.toFixed(2)} TND
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Order Footer */}
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="flex justify-between text-sm">
                            <div>
                              <span className="text-gray-500">{text.shippingAddress}:</span>
                              <span className="ml-2 text-gray-900">
                                {order.shipping_address}, {order.shipping_city}, {order.shipping_country}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">{text.payment}:</span>
                              <span className="ml-2 text-gray-900">{order.payment_status}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Account Information Tab */}
            {activeTab === "account" && userProfile && (
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 font-medium text-gray-900">
                  {text.accountInfo}
                </div>
                <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput
                      label={text.fullName}
                      name="full_name"
                      type="text"
                      register={profileForm.register}
                      error={profileForm.formState.errors.full_name}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {text.email}
                      </label>
                      <input
                        type="email"
                        value={userProfile.email}
                        disabled
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed text-black"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput
                      label={text.phone}
                      name="phone"
                      type="tel"
                      register={profileForm.register}
                      error={profileForm.formState.errors.phone}
                    />
                    <FormInput
                      label={text.country}
                      name="country"
                      type="text"
                      register={profileForm.register}
                      error={profileForm.formState.errors.country}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput
                      label={text.city}
                      name="city"
                      type="text"
                      register={profileForm.register}
                      error={profileForm.formState.errors.city}
                    />
                    <FormInput
                      label={text.address}
                      name="address"
                      type="text"
                      register={profileForm.register}
                      error={profileForm.formState.errors.address}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="px-6 py-2 bg-[#7a3b2e] text-white rounded-md hover:bg-[#5e2d23] transition"
                    >
                      {text.saveChanges}
                    </button>
                    <button
                      type="button"
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                    >
                      {text.cancel}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 font-medium text-gray-900">
                  {text.security}
                </div>
                <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {text.currentPassword}
                    </label>
                    <input
                      type="password"
                      {...passwordForm.register("currentPassword")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7a3b2e] focus:border-transparent transition text-black placeholder:text-[#C9C9C9]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {text.newPassword}
                    </label>
                    <input
                      type="password"
                      {...passwordForm.register("newPassword")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7a3b2e] focus:border-transparent transition text-black placeholder:text-[#C9C9C9]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {text.confirmPassword}
                    </label>
                    <input
                      type="password"
                      {...passwordForm.register("confirmPassword")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7a3b2e] focus:border-transparent transition text-black placeholder:text-[#C9C9C9]"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="px-6 py-2 bg-[#7a3b2e] text-white rounded-md hover:bg-[#5e2d23] transition"
                    >
                      {text.changePassword}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Saved Items Tab */}
            {activeTab === "saved" && (
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 font-medium text-gray-900">
                  {text.savedItems}
                </div>

                {favoritesLoading ? (
                  <div className="p-6 text-center text-gray-500">
                    Loading saved items...
                  </div>
                ) : savedItems.length === 0 ? (
                  <div className="p-6">
                    <div className="text-center text-gray-500 py-12">
                      {text.noSavedItems}
                    </div>
                  </div>
                ) : (
                  <div className="p-6">
                    <div className="flex gap-6 overflow-x-auto pb-4">
                      {savedItems.map((item) => (
                        <ProductListCard
                          key={item.id}
                          product={{
                            id: item.product.id,
                            title: item.product.title,
                            slug: item.product.slug,
                            image_url: item.product.image_url || "/assets/images/logoKachabity.jpg",
                            price_cents: item.product.price_cents,
                            currency: item.product.currency,
                            rating: item.product.rating || 0,
                            review_count: item.product.review_count || 0,
                            discount_percent: item.product.discount_percent
                          }}
                          locale={locale}
                          isFavorite={true}
                          onToggleFavorite={() => handleRemoveFavorite(item.product_id)}
                          onAddToCart={(product) => addItem({
                            id: product.id,
                            name: product.title,
                            price: product.price_cents,
                            image: product.image_url,
                            rating: product.rating,
                            reviewCount: product.review_count,
                          })}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
          <div className="absolute  left-[-160px] top-[550px] ">
            <Image src="/assets/images/checkout/backgroundCheckout.svg" alt="bg-checkout" width={100} height={100} className="w-full h-[full] object-cover" />
          </div>
          <div className="absolute top-55 right-0 ">
            <Image src="/assets/images/checkout/bgCheckoutRight.svg" alt="bg-checkout" width={100} height={100} className="w-full h-full object-cover" />
          </div>
        </div>
      </section>
    </main>
  );
}
