import { z } from "zod";
import { COLISSIMO_GOVERNORATES } from "@/lib/colissimo-data";

// Checkout form validation schema
// Name, phone, governorate, city and delivery address are required. Email is optional.
export const checkoutSchema = z.object({
    firstName: z.string()
        .min(2, "First name must be at least 2 characters")
        .max(50, "First name must be less than 50 characters"),

    lastName: z.string()
        .min(2, "Last name must be at least 2 characters")
        .max(50, "Last name must be less than 50 characters"),

    phone: z.string()
        .regex(/^[24579]\d{7}$/, "Enter a valid 8-digit Tunisian phone number"),

    // Optional field
    email: z.union([
        z.string().email("Please enter a valid email address"),
        z.literal(""),
        z.undefined()
    ]).optional(),

    address: z.string()
        .trim()
        .min(1, "Delivery address is required")
        .max(200, "Address must be less than 200 characters"),

    // Delivery details as the delivery company (Colissimo) needs them: one of its governorates
    // (stored under its exact spelling) and the city.
    state: z.string()
        .refine((value) => COLISSIMO_GOVERNORATES.includes(value), "Choose your governorate"),

    city: z.string()
        .trim()
        .min(1, "City is required")
        .max(100, "City must be less than 100 characters"),

    zipCode: z.string()
        .max(10, "Postal code must be less than 10 characters")
        .optional(),

    country: z.string()
        .optional(),

    orderNotes: z.string()
        .max(500, "Order notes must be less than 500 characters")
        .optional(),

    couponCode: z.string()
        .optional(),
});

// TypeScript type inferred from schema
export type CheckoutFormData = z.infer<typeof checkoutSchema>;
