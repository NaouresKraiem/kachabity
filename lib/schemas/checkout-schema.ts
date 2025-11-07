import { z } from "zod";

// Checkout form validation schema
export const checkoutSchema = z.object({
    firstName: z.string()
        .min(2, "First name must be at least 2 characters")
        .max(50, "First name must be less than 50 characters"),

    lastName: z.string()
        .min(2, "Last name must be at least 2 characters")
        .max(50, "Last name must be less than 50 characters"),

    email: z.string()
        .email("Please enter a valid email address"),

    phone: z.string()
        .min(8, "Phone number must be at least 8 digits")
        .regex(/^[\d\s+()-]+$/, "Please enter a valid phone number"),

    address: z.string()
        .min(5, "Address must be at least 5 characters")
        .max(200, "Address must be less than 200 characters"),

    city: z.string()
        .min(2, "City must be at least 2 characters")
        .max(50, "City must be less than 50 characters"),

    state: z.string()
        .min(2, "State/Province must be at least 2 characters")
        .max(50, "State/Province must be less than 50 characters"),

    zipCode: z.string()
        .min(4, "Postal code must be at least 4 characters")
        .max(10, "Postal code must be less than 10 characters"),

    country: z.string()
        .min(1, "Please select a country"),

    orderNotes: z.string()
        .max(500, "Order notes must be less than 500 characters")
        .optional(),

    couponCode: z.string()
        .optional(),
});

// TypeScript type inferred from schema
export type CheckoutFormData = z.infer<typeof checkoutSchema>;

