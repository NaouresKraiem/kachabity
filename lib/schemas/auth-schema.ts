import { z } from "zod";

const messages = {
    en: {
        email: "Enter a valid email address",
        passwordMin: "Password must be at least 8 characters",
        passwordRequired: "Enter your password",
        name: "Enter your name",
        nameMax: "Name must be 100 characters or less",
        match: "Passwords do not match",
    },
    fr: {
        email: "Saisissez une adresse e-mail valide",
        passwordMin: "Le mot de passe doit contenir au moins 8 caractères",
        passwordRequired: "Saisissez votre mot de passe",
        name: "Saisissez votre nom",
        nameMax: "Le nom doit contenir 100 caractères maximum",
        match: "Les mots de passe ne correspondent pas",
    },
    ar: {
        email: "أدخل بريداً إلكترونياً صحيحاً",
        passwordMin: "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل",
        passwordRequired: "أدخل كلمة المرور",
        name: "أدخل اسمك",
        nameMax: "يجب ألا يتجاوز الاسم 100 حرف",
        match: "كلمتا المرور غير متطابقتين",
    },
};

function t(locale: string) {
    return messages[locale as keyof typeof messages] || messages.en;
}

export function signInSchema(locale: string) {
    const m = t(locale);
    return z.object({
        email: z.string().trim().email(m.email),
        password: z.string().min(1, m.passwordRequired),
    });
}

export function signUpSchema(locale: string) {
    const m = t(locale);
    return z
        .object({
            fullName: z.string().trim().min(2, m.name).max(100, m.nameMax),
            email: z.string().trim().email(m.email),
            password: z.string().min(8, m.passwordMin),
            confirmPassword: z.string(),
        })
        .refine((d) => d.password === d.confirmPassword, { message: m.match, path: ["confirmPassword"] });
}

export function forgotPasswordSchema(locale: string) {
    return z.object({ email: z.string().trim().email(t(locale).email) });
}

export function newPasswordSchema(locale: string) {
    const m = t(locale);
    return z
        .object({
            password: z.string().min(8, m.passwordMin),
            confirmPassword: z.string(),
        })
        .refine((d) => d.password === d.confirmPassword, { message: m.match, path: ["confirmPassword"] });
}

export type SignInFormData = z.infer<ReturnType<typeof signInSchema>>;
export type SignUpFormData = z.infer<ReturnType<typeof signUpSchema>>;
export type ForgotPasswordFormData = z.infer<ReturnType<typeof forgotPasswordSchema>>;
export type NewPasswordFormData = z.infer<ReturnType<typeof newPasswordSchema>>;
