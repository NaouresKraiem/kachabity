"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCart } from "@/lib/cart-context";
import { useLanguage } from "@/lib/language-context";
import { createOrder } from "@/lib/orders";
import { calculateShipping } from "@/lib/shipping";
import { getCountryTaxRate } from "@/lib/get-site-settings";
import { checkoutSchema, type CheckoutFormData } from "@/lib/schemas/checkout-schema";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import StaticHeader from "@/components/layout/StaticHeader";
import Footer from "@/components/footer/Footer";
import CartItem from "@/components/cart/CartItem";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import supabase from "@/lib/supabaseClient";
import { message } from "antd";

const content = {
    en: {
        summaryOrder: "Summary Order",
        information: "Information",
        payment: "Confirmation",
        summaryOrderConfirmation: "Order Confirmation",
        orderInformation: "Order Information",
        orderConfirmationDesc: "Your order has been placed successfully. We will process it shortly.",
        orderInfoDesc: "Please review your order details below",
        orderDate: "Order Date",
        orderNo: "Order No.",
        paymentMethod: "Payment",
        shippingAddress: "Shipping Address",
        billingAddress: "Billing Address",
        firstName: "First Name",
        lastName: "Last Name",
        emailAddress: "Email Address",
        streetAddress: "Street Address",
        stateProvince: "State/Province",
        city: "City",
        zipPostalCode: "Zip/Postal Code",
        phone: "Phone",
        continue: "Continue",
        confirmMyOrder: "Confirm my order",
        processing: "Processing...",
        discountCodes: "Discount Codes",
        enterCoupon: "Enter your coupon code",
        billingSummary: "Billing Summary",
        subtotal: "Subtotal",
        discount: "Discount",
        shipping: "Shipping",
        freeShipping: "Free Shipping",
        tax: "Tax",
        total: "Total",
        grandTotal: "Grand Total",
        orderComment: "Order Comment",
        typeHere: "Type here...",
        acknowledgePolicy: "Please check to acknowledge our Privacy & Terms Policy",
        reviews: "reviews",
        quantity: "Quantity:",
        cashOnDelivery: "Livraison",
        thankYouMessage: "We'll be sending a shipping confirmation email when the items shipped successfully",
        thankYou: "Thank You For Shopping With Us!",
        artisanTeam: "Kachabity Team",
        continueShopping: "Continue Shopping",
        backToHome: "Back to Home"
    },
    fr: {
        summaryOrder: "Résumé de la commande",
        information: "Information",
        payment: "Confirmation",
        summaryOrderConfirmation: "Confirmation de commande",
        orderInformation: "Informations de commande",
        orderConfirmationDesc: "Votre commande a été passée avec succès. Nous la traiterons sous peu.",
        orderInfoDesc: "Veuillez vérifier les détails de votre commande ci-dessous",
        orderDate: "Date de commande",
        orderNo: "N° de commande",
        paymentMethod: "Paiement",
        shippingAddress: "Adresse de livraison",
        billingAddress: "Adresse de facturation",
        firstName: "Prénom",
        lastName: "Nom",
        emailAddress: "Adresse e-mail",
        streetAddress: "Adresse",
        stateProvince: "État/Province",
        city: "Ville",
        zipPostalCode: "Code postal",
        phone: "Téléphone",
        continue: "Continuer",
        confirmMyOrder: "Confirmer ma commande",
        processing: "Traitement...",
        discountCodes: "Codes de réduction",
        enterCoupon: "Entrez votre code promo",
        billingSummary: "Résumé de facturation",
        subtotal: "Sous-total",
        discount: "Réduction",
        shipping: "Livraison",
        freeShipping: "Livraison Gratuite",
        tax: "Taxe",
        total: "Total",
        grandTotal: "Total général",
        orderComment: "Commentaire de commande",
        typeHere: "Écrivez ici...",
        acknowledgePolicy: "Veuillez cocher pour accepter notre politique de confidentialité",
        reviews: "avis",
        quantity: "Quantité:",
        cashOnDelivery: "Livraison",
        thankYouMessage: "Nous vous enverrons un email de confirmation d'expédition",
        thankYou: "Merci d'avoir fait vos achats avec nous!",
        artisanTeam: "Équipe Artisan",
        continueShopping: "Continuer vos achats",
        backToHome: "Retour à l'accueil"
    },
    ar: {
        summaryOrder: "ملخص الطلب",
        information: "معلومات",
        payment: "التأكيد",
        summaryOrderConfirmation: "تأكيد الطلب",
        orderInformation: "معلومات الطلب",
        orderConfirmationDesc: "تم تقديم طلبك بنجاح. سنقوم بمعالجته قريباً.",
        orderInfoDesc: "يرجى مراجعة تفاصيل طلبك أدناه",
        orderDate: "تاريخ الطلب",
        orderNo: "رقم الطلب",
        paymentMethod: "الدفع",
        shippingAddress: "عنوان الشحن",
        billingAddress: "عنوان الفواتير",
        firstName: "الاسم الأول",
        lastName: "اسم العائلة",
        emailAddress: "البريد الإلكتروني",
        streetAddress: "العنوان",
        stateProvince: "الولاية/المحافظة",
        city: "المدينة",
        zipPostalCode: "الرمز البريدي",
        phone: "الهاتف",
        continue: "متابعة",
        confirmMyOrder: "تأكيد طلبي",
        processing: "جاري المعالجة...",
        discountCodes: "رموز الخصم",
        enterCoupon: "أدخل رمز القسيمة",
        billingSummary: "ملخص الفاتورة",
        subtotal: "المجموع الفرعي",
        discount: "الخصم",
        shipping: "الشحن",
        freeShipping: "شحن مجاني",
        tax: "الضريبة",
        total: "المجموع",
        grandTotal: "المجموع الكلي",
        orderComment: "تعليق الطلب",
        typeHere: "اكتب هنا...",
        acknowledgePolicy: "يرجى التحقق للإقرار بسياسة الخصوصية",
        reviews: "تقييم",
        quantity: "الكمية:",
        cashOnDelivery: "التوصيل",
        thankYouMessage: "سنرسل بريدًا إلكترونيًا للتأكيد عند الشحن",
        thankYou: "شكرًا لك على التسوق معنا!",
        artisanTeam: "فريق أرتيزان",
        continueShopping: "متابعة التسوق",
        backToHome: "العودة إلى الصفحة الرئيسية"
    }
};

export default function CheckoutPage() {
    const { items, subtotal, updateQuantity, removeItem, clearCart, isCartLoaded } = useCart();
    const { locale } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const text = content[locale as keyof typeof content] || content.en;

    // Get step from URL or default to 1
    const stepFromUrl = parseInt(searchParams.get('step') || '1', 10);
    const [currentStep, setCurrentStep] = useState(stepFromUrl);
    const [isProcessing, setIsProcessing] = useState(false);
    const [acceptPolicy, setAcceptPolicy] = useState(false);
    const [orderConfirmed, setOrderConfirmed] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Initialize savedItems and savedOrderSummary from sessionStorage if available
    const [savedItems, setSavedItems] = useState<typeof items>(() => {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('checkoutSavedItems');
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });

    const [savedOrderSummary, setSavedOrderSummary] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('checkoutOrderSummary');
            return saved ? JSON.parse(saved) : {
                subtotal: 0,
                shippingCost: 0,
                tax: 0,
                taxRate: 0,
                discount: 0,
                total: 0
            };
        }
        return {
            subtotal: 0,
            shippingCost: 0,
            tax: 0,
            taxRate: 0,
            discount: 0,
            total: 0
        };
    });
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [isBillingOpen, setIsBillingOpen] = useState(true);
    const [isDiscountOpen, setIsDiscountOpen] = useState(false);

    // React Hook Form setup with Zod validation
    const {
        register,
        handleSubmit: handleFormSubmit,
        formState: { errors },
        watch,
        setValue,
    } = useForm<CheckoutFormData>({
        resolver: zodResolver(checkoutSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            address: "",
            city: "",
            state: "",
            zipCode: "",
            country: "Tunisia",
            orderNotes: "",
            couponCode: "",
        },
    });

    // Watch form values for calculations and display
    const formCountry = watch("country");
    const formCity = watch("city");
    const formState = watch("state");

    const [shippingCost, setShippingCost] = useState(7);
    const [taxRate, setTaxRate] = useState(0.19);
    const discount = 0;
    const tax = subtotal * taxRate;
    const total = subtotal - discount + shippingCost + tax;

    // Generate temporary order number for display
    const tempOrderNo = `NIAKZUA${Math.floor(Math.random() * 10000)}`;
    const currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // Get authenticated user ID
    useEffect(() => {
        async function fetchUserId() {
            const { data } = await supabase.auth.getUser();
            if (data.user) {
                setUserId(data.user.id);
            }
        }
        fetchUserId();
    }, []);

    // Load saved data from sessionStorage on mount (for page refreshes)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedItemsData = sessionStorage.getItem('checkout_savedItems');
            const savedSummaryData = sessionStorage.getItem('checkout_savedOrderSummary');
            const confirmedStatus = sessionStorage.getItem('checkout_orderConfirmed');

            if (savedItemsData) {
                try {
                    setSavedItems(JSON.parse(savedItemsData));
                } catch (e) {
                    console.error('Error parsing saved items:', e);
                }
            }

            if (savedSummaryData) {
                try {
                    setSavedOrderSummary(JSON.parse(savedSummaryData));
                } catch (e) {
                    console.error('Error parsing saved summary:', e);
                }
            }

            if (confirmedStatus === 'true') {
                setOrderConfirmed(true);
            }
        }
    }, []);

    const handleContinueFromSummary = () => {
        setCurrentStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleContinueFromInformation = () => {
        // Save cart items and order summary before moving to step 3
        const itemsToSave = [...items];
        const summaryToSave = {
            subtotal: subtotal,
            shippingCost: shippingCost,
            tax: tax,
            taxRate: taxRate,
            discount: discount,
            total: total
        };

        setSavedItems(itemsToSave);
        setSavedOrderSummary(summaryToSave);

        // Persist to sessionStorage for page refresh
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('checkoutSavedItems', JSON.stringify(itemsToSave));
            sessionStorage.setItem('checkoutOrderSummary', JSON.stringify(summaryToSave));
        }

        setCurrentStep(3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const onSubmit = async (formData: CheckoutFormData) => {
        if (!acceptPolicy) {
            message.error(text.acknowledgePolicy);
            return;
        }

        setIsProcessing(true);

        try {
            const orderData = {
                userId: userId || undefined, // Include user ID if authenticated
                customerEmail: formData.email,
                customerFirstName: formData.firstName,
                customerLastName: formData.lastName,
                customerPhone: formData.phone,
                shippingAddress: formData.address,
                shippingCity: formData.city,
                shippingState: formData.state,
                shippingZip: formData.zipCode,
                shippingCountry: formData.country,
                items: items,
                subtotal: subtotal,
                shippingCost: shippingCost,
                total: total,
                orderNotes: formData.orderNotes || ""
            };

            const { order, error } = await createOrder(orderData);

            if (error || !order) {
                message.error("Failed to create order. Please try again.");
                setIsProcessing(false);
                return;
            }

            // Send order confirmation email via API
            try {
                // Convert cart items to order items format
                const orderItemsForEmail = items.map(item => ({
                    id: item.id,
                    order_id: order.id,
                    product_id: item.id,
                    product_name: item.name,
                    product_name_ar: item.name_ar,
                    product_name_fr: item.name_fr,
                    product_image: item.image,
                    quantity: item.quantity,
                    price: item.price,
                    subtotal: item.price * item.quantity
                }));

                const emailResponse = await fetch('/api/send-order-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        order: order,
                        orderItems: orderItemsForEmail,
                        customerName: `${formData.firstName} ${formData.lastName}`
                    })
                });

                if (!emailResponse.ok) {
                    const errorData = await emailResponse.json();
                    console.error("Failed to send confirmation email:", {
                        status: emailResponse.status,
                        statusText: emailResponse.statusText,
                        error: errorData
                    });
                    // Don't block the order process if email fails
                }
            } catch (emailError) {
                console.error("Error sending confirmation email:", emailError);
                // Don't block the order process if email fails
            }

            // Save cart items and order summary for confirmation page
            const itemsToSave = [...items];
            const summaryToSave = {
                subtotal: subtotal,
                shippingCost: shippingCost,
                tax: tax,
                taxRate: taxRate,
                discount: discount,
                total: total
            };

            setSavedItems(itemsToSave);
            setSavedOrderSummary(summaryToSave);

            // Persist to sessionStorage for page refresh
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('checkoutSavedItems', JSON.stringify(itemsToSave));
                sessionStorage.setItem('checkoutOrderSummary', JSON.stringify(summaryToSave));
                sessionStorage.setItem('orderConfirmed', 'true');
            }

            clearCart();

            // Reset processing state, mark order as confirmed, and move to confirmation step
            setIsProcessing(false);
            setOrderConfirmed(true);
            setCurrentStep(3);
        } catch (error) {
            message.error("An error occurred. Please try again.");
            setIsProcessing(false);
        }
    };
    function getCountryCode(countryName: string): string {
        const mapping: Record<string, string> = {
            'Tunisia': 'TN',
            'Algeria': 'DZ',
            'Morocco': 'MA',
            'Libya': 'LY',
            'Egypt': 'EG'
        };
        return mapping[countryName] || 'TN';
    }
    // Calculate shipping cost and tax rate dynamically based on country
    useEffect(() => {
        async function fetchShippingAndTax() {
            if (!formCountry || subtotal === 0) return;

            const countryCode = getCountryCode(formCountry);

            // Fetch both shipping cost and country-specific tax rate
            const [shippingResult, countryTaxRate] = await Promise.all([
                calculateShipping(countryCode, subtotal, 'standard'),
                getCountryTaxRate(countryCode)
            ]);

            const { cost } = shippingResult;

            setShippingCost(cost);
            setTaxRate(countryTaxRate);
        }

        fetchShippingAndTax();
    }, [formCountry, subtotal]);

    // Sync step with URL
    useEffect(() => {
        const newUrl = `/${locale}/checkout?step=${currentStep}`;
        router.replace(newUrl, { scroll: false });
    }, [currentStep, locale, router]);

    // Redirect to cart only after cart is loaded and if there are no items
    useEffect(() => {
        if (isCartLoaded && items.length === 0 && savedItems.length === 0 && currentStep !== 3) {
            router.push(`/${locale}/cart`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCartLoaded]); // Only check after cart is loaded

    // Show loading while cart is loading
    if (!isCartLoaded) {
        return <LoadingSpinner message="Loading..." />;
    }

    // Show loading or null while redirecting (but allow step 3 to show even with saved items)
    if (items.length === 0 && savedItems.length === 0 && currentStep !== 3) {
        return null;
    }

    // Use savedItems for step 3, regular items for other steps
    const displayItems = currentStep === 3 ? savedItems : items;

    return (
        <>
            <StaticHeader />

            <div className="min-h-screen bg-[#FFFFFF] py-12">
                <div className=" mx-auto px-4">
                    {/* Step Progress */}
                    <div className="mb-12">
                        <div className="flex items-center justify-center gap-4">
                            {/* Step 1: Summary Order */}
                            <div className="flex items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${currentStep > 1 ? 'bg-green-600' : currentStep === 1 ? 'bg-[#7a3b2e]' : 'bg-gray-300'}`}>
                                        {currentStep > 1 ? '✓' : '1'}
                                    </div>
                                    <span className={`font-medium ${currentStep === 1 ? 'text-[#7a3b2e]' : currentStep > 1 ? 'text-green-600' : 'text-gray-600'}`}>
                                        {text.summaryOrder}
                                    </span>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className={`w-16 h-0.5 ${currentStep > 1 ? 'bg-green-600' : 'bg-gray-300'}`}></div>

                            {/* Step 2: Information */}
                            <div className="flex items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${currentStep > 2 ? 'bg-green-600' : currentStep === 2 ? 'bg-[#7a3b2e]' : 'bg-gray-300'}`}>
                                        {currentStep > 2 ? '✓' : '2'}
                                    </div>
                                    <span className={`font-medium ${currentStep === 2 ? 'text-[#7a3b2e]' : currentStep > 2 ? 'text-green-600' : 'text-gray-600'}`}>
                                        {text.information}
                                    </span>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className={`w-16 h-0.5 ${currentStep > 2 ? 'bg-green-600' : 'bg-gray-300'}`}></div>

                            {/* Step 3: Payment */}
                            <div className="flex items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${currentStep === 3 ? 'bg-green-600' : 'bg-gray-300'}`}>
                                        {currentStep === 3 ? '✓' : '3'}
                                    </div>
                                    <span className={`font-medium ${currentStep === 3 ? 'text-green-600' : 'text-gray-600'}`}>
                                        {text.payment}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="absolute left-[-150] ">
                        <Image src="/assets/images/checkout/backgroundCheckout.svg" alt="bg-checkout" width={100} height={100} className="w-full h-full object-cover" />
                    </div>
                    {/* Step 1: Summary Order */}
                    {currentStep === 1 && (
                        <div className="max-w-3xl mx-auto">
                            <div className=" p-8">
                                <h2 className="text-2xl font-bold text-gray-900 mb-6">{text.summaryOrder}</h2>

                                <div className="space-y-6 mb-8">
                                    {items.map((item) => (
                                        <CartItem
                                            key={item.id}
                                            item={item}
                                            onUpdateQuantity={updateQuantity}
                                            onRemove={removeItem}
                                            variant="default"
                                            reviewsText="reviews"
                                        />
                                    ))}
                                </div>

                                <button
                                    onClick={handleContinueFromSummary}
                                    type="button"
                                    className="w-full py-4 bg-[#7a3b2e] text-white text-lg rounded-lg hover:bg-[#5e2d23] transition font-medium"
                                >
                                    {text.continue}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Information */}
                    {currentStep === 2 && (
                        <div className=" mx-auto max-w-6xl grid lg:grid-cols-3 gap-8">
                            {/* Left Side - Form */}
                            <div className="lg:col-span-2">
                                <form onSubmit={handleFormSubmit(handleContinueFromInformation)} className="bg-white rounded-lg shadow-sm p-8">
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{text.information}</h2>
                                    <p className="text-gray-500 text-sm mb-6">Please fill in your shipping information to continue</p>

                                    <div className="space-y-6">
                                        <h3 className="text-xl font-bold text-gray-900">{text.billingAddress}</h3>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    {text.firstName}
                                                </label>
                                                <input
                                                    type="text"
                                                    {...register("firstName")}
                                                    placeholder="Enter your first name"
                                                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#842E1B] focus:border-transparent text-black placeholder:text-[#C9C9C9] ${errors.firstName ? 'border-red-500' : 'border-gray-300'}`}
                                                />
                                                {errors.firstName && (
                                                    <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    {text.lastName}
                                                </label>
                                                <input
                                                    type="text"
                                                    {...register("lastName")}
                                                    placeholder="Enter your Last Name"
                                                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#842E1B] focus:border-transparent text-black placeholder:text-[#C9C9C9] ${errors.lastName ? 'border-red-500' : 'border-gray-300'}`}
                                                />
                                                {errors.lastName && (
                                                    <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {text.emailAddress}
                                            </label>
                                            <input
                                                type="email"
                                                {...register("email")}
                                                placeholder="Enter your Email Address"
                                                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#842E1B] focus:border-transparent text-black placeholder:text-[#C9C9C9] ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                                            />
                                            {errors.email && (
                                                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {text.streetAddress}
                                            </label>
                                            <input
                                                type="text"
                                                {...register("address")}
                                                placeholder="Enter your Street Address"
                                                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#842E1B] focus:border-transparent text-black placeholder:text-[#C9C9C9] ${errors.address ? 'border-red-500' : 'border-gray-300'}`}
                                            />
                                            {errors.address && (
                                                <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    {text.stateProvince}
                                                </label>
                                                <input
                                                    type="text"
                                                    {...register("state")}
                                                    placeholder="Enter your State"
                                                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#842E1B] focus:border-transparent text-black placeholder:text-[#C9C9C9] ${errors.state ? 'border-red-500' : 'border-gray-300'}`}
                                                />
                                                {errors.state && (
                                                    <p className="mt-1 text-sm text-red-600">{errors.state.message}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    {text.city}
                                                </label>
                                                <input
                                                    type="text"
                                                    {...register("city")}
                                                    placeholder="Enter your City"
                                                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#842E1B] focus:border-transparent text-black placeholder:text-[#C9C9C9] ${errors.city ? 'border-red-500' : 'border-gray-300'}`}
                                                />
                                                {errors.city && (
                                                    <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    {text.zipPostalCode}
                                                </label>
                                                <input
                                                    type="text"
                                                    {...register("zipCode")}
                                                    placeholder="Enter your Postal Code"
                                                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#842E1B] focus:border-transparent text-black placeholder:text-[#C9C9C9] ${errors.zipCode ? 'border-red-500' : 'border-gray-300'}`}
                                                />
                                                {errors.zipCode && (
                                                    <p className="mt-1 text-sm text-red-600">{errors.zipCode.message}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Country
                                                </label>
                                                <select
                                                    {...register("country")}
                                                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#842E1B] focus:border-transparent text-black placeholder:text-[#C9C9C9] ${errors.country ? 'border-red-500' : 'border-gray-300'}`}
                                                >
                                                    <option value="Tunisia">Tunisia</option>
                                                    <option value="Algeria">Algeria</option>
                                                    <option value="Morocco">Morocco</option>
                                                    <option value="Libya">Libya</option>
                                                    <option value="Egypt">Egypt</option>
                                                </select>
                                                {errors.country && (
                                                    <p className="mt-1 text-sm text-red-600">{errors.country.message}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {text.phone}
                                            </label>
                                            <input
                                                type="tel"
                                                {...register("phone")}
                                                placeholder="+ 216 000 000 000"
                                                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#842E1B] focus:border-transparent text-black placeholder:text-[#C9C9C9] ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
                                            />
                                            {errors.phone && (
                                                <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                                            )}
                                        </div>

                                        <button
                                            type="submit"
                                            className="w-full py-4 bg-[#7a3b2e] text-white text-lg rounded-lg hover:bg-[#5e2d23] transition font-medium"
                                        >
                                            {text.continue}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Right Side - Summary */}
                            <div className="lg:col-span-1 space-y-6">
                                {/* Summary Order - Collapsible */}
                                <div className="bg-white  shadow-sm">
                                    <button
                                        onClick={() => setIsSummaryOpen(!isSummaryOpen)}
                                        className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition"
                                    >
                                        <h3 className="text-[20px] font-semibold text-black">{text.summaryOrder}</h3>
                                        <svg
                                            className={`w-6 h-6 transition-transform ${isSummaryOpen ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {isSummaryOpen && (
                                        <div className="px-6 pb-6 space-y-3 border-t pt-4">
                                            {items.map((item) => (
                                                <CartItem
                                                    key={item.id}
                                                    item={item}
                                                    variant="compact"
                                                    reviewsText={text.reviews}
                                                    showTotal={false}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Discount Codes - Collapsible */}
                                <div className="bg-white shadow-sm">
                                    <button
                                        onClick={() => setIsDiscountOpen(!isDiscountOpen)}
                                        className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition"
                                    >
                                        <h3 className="text-[20px] font-semibold text-black">{text.discountCodes}</h3>
                                        <svg
                                            className={`w-6 h-6 transition-transform ${isDiscountOpen ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {isDiscountOpen && (
                                        <div className="px-6 pb-6 border-t pt-4">
                                            <input
                                                type="text"
                                                {...register("couponCode")}
                                                placeholder={text.enterCoupon}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a3b2e] focus:border-transparent text-black placeholder:text-[#C9C9C9]"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Billing Summary - Collapsible */}
                                <div className="bg-white  shadow-sm">
                                    <button
                                        onClick={() => setIsBillingOpen(!isBillingOpen)}
                                        className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition"
                                    >
                                        <h3 className="text-[20px] font-semibold text-black">{text.billingSummary}</h3>
                                        <svg
                                            className={`w-6 h-6 transition-transform ${isBillingOpen ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {isBillingOpen && (
                                        <div className="px-6 pb-6 border-t pt-4 space-y-4">
                                            <div className="space-y-3">
                                                <div className="flex justify-between text-gray-700">
                                                    <span>{text.subtotal}</span>
                                                    <span className="font-semibold">{subtotal.toFixed(2)} TND</span>
                                                </div>
                                                {discount > 0 && (
                                                    <div className="flex justify-between text-gray-700">
                                                        <span>{text.discount}</span>
                                                        <span className="font-semibold">-{discount.toFixed(2)} TND</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-gray-700">
                                                    <span>{text.shipping}</span>
                                                    {shippingCost === 0 ? (
                                                        <span className="font-semibold text-green-600">{text.freeShipping}</span>
                                                    ) : (
                                                        <span className="font-semibold">{shippingCost.toFixed(2)} TND</span>
                                                    )}
                                                </div>
                                                {tax > 0 && (
                                                    <div className="flex justify-between text-gray-700">
                                                        <span>{text.tax} ({(taxRate * 100).toFixed(0)}%)</span>
                                                        <span className="font-semibold">{tax.toFixed(2)} TND</span>
                                                    </div>
                                                )}
                                                <div className="border-t pt-3">
                                                    <div className="flex justify-between text-xl font-bold text-gray-900">
                                                        <span>{text.grandTotal}</span>
                                                        <span>{total.toFixed(2)} TND</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Order Comment */}
                                            <div className="mt-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    {text.orderComment}
                                                </label>
                                                <textarea
                                                    {...register("orderNotes")}
                                                    placeholder={text.typeHere}
                                                    rows={4}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a3b2e] focus:border-transparent resize-none text-black placeholder:text-[#C9C9C9]"
                                                />
                                            </div>

                                            {/* Privacy Policy Checkbox */}
                                            <div className="mt-4">
                                                <label className="flex items-start gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={acceptPolicy}
                                                        onChange={(e) => setAcceptPolicy(e.target.checked)}
                                                        className="mt-1 w-4 h-4 text-[#842E1B] border-gray-300 rounded focus:ring-[#842E1B]"
                                                    />
                                                    <span className="text-sm text-gray-600">
                                                        {text.acknowledgePolicy}
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Confirmation */}
                    {currentStep === 3 && (
                        <div className="max-w-3xl mx-auto">
                            <div className="bg-white rounded-lg shadow-sm p-8">
                                <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">{text.summaryOrderConfirmation}</h2>
                                <p className="text-gray-500 text-sm text-center mb-8">{text.orderConfirmationDesc}</p>

                                {/* Order Information */}
                                <div className="mb-8">
                                    <h3 className="text-xl font-bold text-gray-900 mb-4">{text.orderInformation}</h3>
                                    <p className="text-gray-500 text-sm mb-6">{text.orderInfoDesc}</p>

                                    <div className="grid grid-cols-4 gap-6">
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">{text.orderDate}</p>
                                            <p className="font-semibold text-gray-900">{currentDate}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">{text.orderNo}</p>
                                            <p className="font-semibold text-gray-900">{tempOrderNo}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">{text.paymentMethod}</p>
                                            <p className="font-semibold text-gray-900">{text.cashOnDelivery}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">{text.shippingAddress}</p>
                                            <p className="font-semibold text-gray-900">{formCity}, {formState}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Products List */}
                                <div className="space-y-6 mb-8">
                                    {displayItems.map((item) => (
                                        <CartItem
                                            key={item.id}
                                            item={item}
                                            variant="default"
                                            reviewsText={text.reviews}
                                        />
                                    ))}
                                </div>

                                {/* Billing Summary */}
                                <div className="border-t pt-6 mb-8">
                                    <div className="flex justify-end">
                                        <div className="w-80 space-y-3">
                                            <div className="flex justify-between text-gray-700">
                                                <span>{text.subtotal}</span>
                                                <span className="font-semibold">{savedOrderSummary.subtotal.toFixed(2)} TND</span>
                                            </div>
                                            {savedOrderSummary.discount > 0 && (
                                                <div className="flex justify-between text-gray-700">
                                                    <span>{text.discount}</span>
                                                    <span className="font-semibold">-{savedOrderSummary.discount.toFixed(2)} TND</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between text-gray-700">
                                                <span>{text.shipping}</span>
                                                {savedOrderSummary.shippingCost === 0 ? (
                                                    <span className="font-semibold text-green-600">{text.freeShipping}</span>
                                                ) : (
                                                    <span className="font-semibold">{savedOrderSummary.shippingCost.toFixed(2)} TND</span>
                                                )}
                                            </div>
                                            {savedOrderSummary.tax > 0 && (
                                                <div className="flex justify-between text-gray-700">
                                                    <span>{text.tax} ({(savedOrderSummary.taxRate * 100).toFixed(0)}%)</span>
                                                    <span className="font-semibold">{savedOrderSummary.tax.toFixed(2)} TND</span>
                                                </div>
                                            )}
                                            <div className="border-t pt-3">
                                                <div className="flex justify-between text-xl font-bold text-gray-900">
                                                    <span>{text.total}</span>
                                                    <span>{savedOrderSummary.total.toFixed(2)} TND</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Conditional Rendering: Policy & Confirm Button OR Continue Shopping */}
                                {!orderConfirmed ? (
                                    <>
                                        {/* Privacy Policy Checkbox */}
                                        <div className="mb-6">
                                            <label className="flex items-start gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={acceptPolicy}
                                                    onChange={(e) => setAcceptPolicy(e.target.checked)}
                                                    className="mt-1 w-4 h-4 text-[#842E1B] border-gray-300 rounded focus:ring-[#842E1B]"
                                                />
                                                <span className="text-sm text-gray-600">
                                                    {text.acknowledgePolicy}
                                                </span>
                                            </label>
                                        </div>

                                        {/* Confirm Order Button */}
                                        <form onSubmit={handleFormSubmit(onSubmit)}>
                                            <button
                                                type="submit"
                                                disabled={isProcessing || !acceptPolicy}
                                                className="w-full py-4 bg-[#7a3b2e] text-white text-lg rounded-lg hover:bg-[#5e2d23] transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isProcessing ? text.processing : text.confirmMyOrder}
                                            </button>
                                        </form>
                                    </>
                                ) : (
                                    <>
                                        {/* Order Confirmed - Show Continue Shopping Button */}
                                        <div className="mb-6 p-4 bg-green-50 border-2 border-green-500 rounded-lg text-center">
                                            <div className="flex items-center justify-center gap-2 text-green-700 font-semibold text-lg mb-2">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Order Confirmed Successfully!
                                            </div>
                                            <p className="text-green-600 text-sm">
                                                Check your email for order details
                                            </p>
                                        </div>

                                        {/* Continue Shopping Button */}
                                        <button
                                            onClick={() => {
                                                // Clear checkout session data
                                                if (typeof window !== 'undefined') {
                                                    sessionStorage.removeItem('checkoutSavedItems');
                                                    sessionStorage.removeItem('checkoutOrderSummary');
                                                    sessionStorage.removeItem('orderConfirmed');
                                                }
                                                router.push(`/${locale}`);
                                            }}
                                            className="w-full py-4 bg-[#7a3b2e] text-white text-lg rounded-lg hover:bg-[#5e2d23] transition font-medium flex items-center justify-center gap-2"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            {text.continueShopping}
                                        </button>
                                    </>
                                )}

                                {/* Thank You Message */}
                                <div className="mt-8 text-center">
                                    <p className="text-sm text-gray-500 mb-4">
                                        {text.thankYouMessage}
                                    </p>
                                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                                        {text.thankYou}
                                    </h3>
                                    <p className="text-gray-600">
                                        {text.artisanTeam}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="absolute top-70 right-0 ">
                        <Image src="/assets/images/checkout/bgCheckoutRight.svg" alt="bg-checkout" width={100} height={100} className="w-full h-full object-cover" />
                    </div>
                </div>
            </div>

            <Footer />
        </>
    );
}

