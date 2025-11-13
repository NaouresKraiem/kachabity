import { z } from "zod";

// Checkout form validation schema
// Only firstName, lastName, and phone are required to simplify checkout
export const checkoutSchema = z.object({
    firstName: z.string()
        .min(2, "First name must be at least 2 characters")
        .max(50, "First name must be less than 50 characters"),

    lastName: z.string()
        .min(2, "Last name must be at least 2 characters")
        .max(50, "Last name must be less than 50 characters"),

    phone: z.string()
        .min(8, "Phone number must be at least 8 digits")
        .regex(/^[\d\s+()-]+$/, "Please enter a valid phone number"),

    // Optional fields
    email: z.union([
        z.string().email("Please enter a valid email address"),
        z.literal(""),
        z.undefined()
    ]).optional(),

    address: z.string()
        .max(200, "Address must be less than 200 characters")
        .optional(),

    city: z.string()
        .max(50, "City must be less than 50 characters")
        .optional(),

    state: z.string()
        .max(50, "State/Province must be less than 50 characters")
        .optional(),

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

