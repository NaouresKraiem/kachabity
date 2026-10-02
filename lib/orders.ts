import supabase from "./supabaseClient";
import { CartItem } from "./cart-context";

export interface OrderData {
    customerEmail?: string; // Optional - only name and phone are required
    customerFirstName: string;
    customerLastName: string;
    customerPhone: string;
    shippingAddress?: string; // Optional
    shippingCity?: string; // Optional
    shippingState?: string; // Optional
    shippingZip?: string; // Optional
    shippingCountry?: string; // Optional
    items: CartItem[];
    subtotal: number;
    shippingCost: number;
    total: number;
    orderNotes?: string; // Optional customer notes
    userId?: string;
    cartId?: string; // Optional: link order to cart for analytics
}

export interface Order {
    id: string;
    order_number: string;
    user_id?: string;
    customer_email: string;
    customer_first_name: string;
    customer_last_name: string;
    customer_phone?: string;
    shipping_address: string;
    shipping_city: string;
    shipping_state?: string;
    shipping_zip?: string;
    shipping_country: string;
    subtotal: number;
    shipping_cost: number;
    total: number;
    order_notes?: string;
    status: string;
    payment_status: string;
    created_at: string;
    updated_at: string;
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    product_name: string;
    product_name_ar?: string;
    product_name_fr?: string;
    product_image?: string;
    variant_id?: string | null;
    /** e.g. "Black / XL" */
    variant_label?: string | null;
    quantity: number;
    price: number;
    subtotal: number;
    created_at: string;
}

/**
 * Create a new order via POST /api/orders.
 *
 * Orders are written server-side because RLS does not let shoppers insert
 * orders directly. The access token (when signed in) lets the server link the
 * order to the user after verifying it.
 */
export async function createOrder(orderData: OrderData): Promise<{ order: Order | null; error: Error | null; code?: string }> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        // The server derives the user from the token, never from the payload.
        const payload = { ...orderData, userId: undefined, cartId: undefined };

        const response = await fetch("/api/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            body: JSON.stringify(payload),
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            // code (e.g. PRICES_CHANGED) lets the checkout show a specific message.
            return { order: null, error: new Error(result.error || "Failed to create order"), code: result.code };
        }

        return { order: result.data as Order, error: null };
    } catch (error) {
        console.error("Error creating order:", error);
        return { order: null, error: error as Error };
    }
}

/**
 * Get order by order number
 */
export async function getOrderByNumber(orderNumber: string): Promise<{ order: Order | null; items: OrderItem[] | null; error: Error | null }> {
    try {
        // Get order
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select("*")
            .eq("order_number", orderNumber)
            .single();

        if (orderError) {
            throw orderError;
        }

        // Get order items
        const { data: items, error: itemsError } = await supabase
            .from("order_items")
            .select("*")
            .eq("order_id", order.id);

        if (itemsError) {
            throw itemsError;
        }

        return { order, items, error: null };
    } catch (error) {
        console.error("Error fetching order:", error);
        return { order: null, items: null, error: error as Error };
    }
}

/**
 * Get all orders for a user
 */
export async function getUserOrders(userId: string): Promise<{ orders: Order[] | null; error: Error | null }> {
    try {
        const { data: orders, error } = await supabase
            .from("orders")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        return { orders, error: null };
    } catch (error) {
        console.error("Error fetching user orders:", error);
        return { orders: null, error: error as Error };
    }
}

/**
 * Update order status
 */
export async function updateOrderStatus(orderId: string, status: string): Promise<{ success: boolean; error: Error | null }> {
    try {
        const { error } = await supabase
            .from("orders")
            .update({ status })
            .eq("id", orderId);

        if (error) {
            throw error;
        }

        return { success: true, error: null };
    } catch (error) {
        console.error("Error updating order status:", error);
        return { success: false, error: error as Error };
    }
}

/**
 * Update payment status
 */
export async function updatePaymentStatus(orderId: string, paymentStatus: string): Promise<{ success: boolean; error: Error | null }> {
    try {
        const { error } = await supabase
            .from("orders")
            .update({ payment_status: paymentStatus })
            .eq("id", orderId);

        if (error) {
            throw error;
        }

        return { success: true, error: null };
    } catch (error) {
        console.error("Error updating payment status:", error);
        return { success: false, error: error as Error };
    }
}

