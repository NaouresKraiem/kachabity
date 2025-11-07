import supabase from "./supabaseClient";
import { CartItem } from "./cart-context";

export interface OrderData {
    customerEmail: string;
    customerFirstName: string;
    customerLastName: string;
    customerPhone: string;
    shippingAddress: string;
    shippingCity: string;
    shippingState: string;
    shippingZip: string;
    shippingCountry: string;
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
    quantity: number;
    price: number;
    subtotal: number;
    created_at: string;
}

/**
 * Generate a unique order number
 */
function generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${timestamp}-${random}`;
}

/**
 * Create a new order in the database
 * 
 * This function:
 * 1. Creates order in orders table
 * 2. Creates order items in order_items table
 * 3. Marks cart as "converted" for analytics
 * 4. Clears the cart (ready for next purchase)
 */
export async function createOrder(orderData: OrderData): Promise<{ order: Order | null; error: Error | null }> {
    try {
        const orderNumber = generateOrderNumber();

        // Insert order
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .insert({
                order_number: orderNumber,
                user_id: orderData.userId || null,
                customer_email: orderData.customerEmail,
                customer_first_name: orderData.customerFirstName,
                customer_last_name: orderData.customerLastName,
                customer_phone: orderData.customerPhone,
                shipping_address: orderData.shippingAddress,
                shipping_city: orderData.shippingCity,
                shipping_state: orderData.shippingState,
                shipping_zip: orderData.shippingZip,
                shipping_country: orderData.shippingCountry,
                subtotal: orderData.subtotal,
                shipping_cost: orderData.shippingCost,
                total: orderData.total,
                order_notes: orderData.orderNotes || null,
                status: "pending",
                payment_status: "pending"
            })
            .select()
            .single();

        if (orderError) {
            throw orderError;
        }

        // Insert order items
        const orderItems = orderData.items.map(item => ({
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

        const { error: itemsError } = await supabase
            .from("order_items")
            .insert(orderItems);

        if (itemsError) {
            throw itemsError;
        }

        // Note: Cart clearing is handled by the CartContext in the checkout component


        return { order, error: null };
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

