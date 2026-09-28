"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AuthChangeEvent, AuthError, Session } from "@supabase/auth-js";
import supabase from "@/lib/supabaseClient";
import { isRTL } from "@/lib/language-utils";
import { safeRedirect, type AuthReason } from "@/lib/customer-auth";
import { FormInput } from "@/components/forms";
import {
    signInSchema,
    signUpSchema,
    forgotPasswordSchema,
    newPasswordSchema,
    type SignInFormData,
    type SignUpFormData,
    type ForgotPasswordFormData,
    type NewPasswordFormData,
} from "@/lib/schemas/auth-schema";

type Mode = "signin" | "signup" | "forgot" | "reset";

const content = {
    en: {
        signInTitle: "Log in",
        signUpTitle: "Create an account",
        forgotTitle: "Reset your password",
        resetTitle: "Choose a new password",
        signInTab: "Log in",
        signUpTab: "Create account",
        fullName: "Full name",
        email: "Email",
        password: "Password",
        confirmPassword: "Confirm password",
        newPassword: "New password",
        signInButton: "Log in",
        signUpButton: "Create account",
        forgotButton: "Send reset link",
        resetButton: "Save new password",
        forgotLink: "Forgot your password?",
        backToSignIn: "Back to log in",
        working: "Please wait…",
        reasons: {
            favorites: "Log in or create an account to save products you like.",
            review: "Log in or create an account to write a review.",
            account: "Log in to see your orders and account details.",
        },
        checkInbox: (email: string) =>
            `We sent a confirmation link to ${email}. Open it to activate your account, then log in.`,
        resetSent: (email: string) =>
            `If an account exists for ${email}, you'll receive a link to reset your password.`,
        passwordUpdated: "Your password has been changed.",
        resetLinkInvalid: "This reset link has expired. Request a new one below.",
        errors: {
            invalid_credentials: "Wrong email or password.",
            email_not_confirmed: "Confirm your email first: open the link we sent you.",
            user_already_exists: "An account with this email already exists. Log in instead.",
            weak_password: "Choose a stronger password.",
            rate_limit: "Too many attempts. Wait a few minutes and try again.",
            generic: "Something went wrong. Try again.",
        },
    },
    fr: {
        signInTitle: "Connexion",
        signUpTitle: "Créer un compte",
        forgotTitle: "Réinitialiser le mot de passe",
        resetTitle: "Choisissez un nouveau mot de passe",
        signInTab: "Se connecter",
        signUpTab: "Créer un compte",
        fullName: "Nom complet",
        email: "E-mail",
        password: "Mot de passe",
        confirmPassword: "Confirmer le mot de passe",
        newPassword: "Nouveau mot de passe",
        signInButton: "Se connecter",
        signUpButton: "Créer mon compte",
        forgotButton: "Envoyer le lien",
        resetButton: "Enregistrer le mot de passe",
        forgotLink: "Mot de passe oublié ?",
        backToSignIn: "Retour à la connexion",
        working: "Veuillez patienter…",
        reasons: {
            favorites: "Connectez-vous ou créez un compte pour enregistrer les produits qui vous plaisent.",
            review: "Connectez-vous ou créez un compte pour laisser un avis.",
            account: "Connectez-vous pour voir vos commandes et votre compte.",
        },
        checkInbox: (email: string) =>
            `Nous avons envoyé un lien de confirmation à ${email}. Ouvrez-le pour activer votre compte, puis connectez-vous.`,
        resetSent: (email: string) =>
            `Si un compte existe pour ${email}, vous recevrez un lien pour réinitialiser votre mot de passe.`,
        passwordUpdated: "Votre mot de passe a été modifié.",
        resetLinkInvalid: "Ce lien a expiré. Demandez-en un nouveau ci-dessous.",
        errors: {
            invalid_credentials: "E-mail ou mot de passe incorrect.",
            email_not_confirmed: "Confirmez d'abord votre e-mail en ouvrant le lien envoyé.",
            user_already_exists: "Un compte existe déjà avec cet e-mail. Connectez-vous.",
            weak_password: "Choisissez un mot de passe plus solide.",
            rate_limit: "Trop de tentatives. Réessayez dans quelques minutes.",
            generic: "Une erreur est survenue. Réessayez.",
        },
    },
    ar: {
        signInTitle: "تسجيل الدخول",
        signUpTitle: "إنشاء حساب",
        forgotTitle: "إعادة تعيين كلمة المرور",
        resetTitle: "اختر كلمة مرور جديدة",
        signInTab: "تسجيل الدخول",
        signUpTab: "إنشاء حساب",
        fullName: "الاسم الكامل",
        email: "البريد الإلكتروني",
        password: "كلمة المرور",
        confirmPassword: "تأكيد كلمة المرور",
        newPassword: "كلمة المرور الجديدة",
        signInButton: "تسجيل الدخول",
        signUpButton: "إنشاء الحساب",
        forgotButton: "إرسال الرابط",
        resetButton: "حفظ كلمة المرور",
        forgotLink: "نسيت كلمة المرور؟",
        backToSignIn: "العودة إلى تسجيل الدخول",
        working: "يرجى الانتظار…",
        reasons: {
            favorites: "سجّل الدخول أو أنشئ حساباً لحفظ المنتجات التي تعجبك.",
            review: "سجّل الدخول أو أنشئ حساباً لكتابة تقييم.",
            account: "سجّل الدخول لعرض طلباتك ومعلومات حسابك.",
        },
        checkInbox: (email: string) =>
            `أرسلنا رابط تأكيد إلى ${email}. افتحه لتفعيل حسابك ثم سجّل الدخول.`,
        resetSent: (email: string) =>
            `إذا كان هناك حساب مرتبط بـ ${email}، فستصلك رسالة تحتوي على رابط لإعادة تعيين كلمة المرور.`,
        passwordUpdated: "تم تغيير كلمة المرور.",
        resetLinkInvalid: "انتهت صلاحية هذا الرابط. اطلب رابطاً جديداً أدناه.",
        errors: {
            invalid_credentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
            email_not_confirmed: "أكّد بريدك الإلكتروني أولاً بفتح الرابط الذي أرسلناه.",
            user_already_exists: "يوجد حساب بهذا البريد الإلكتروني. سجّل الدخول بدلاً من ذلك.",
            weak_password: "اختر كلمة مرور أقوى.",
            rate_limit: "محاولات كثيرة. انتظر بضع دقائق ثم حاول مجدداً.",
            generic: "حدث خطأ. حاول مجدداً.",
        },
    },
};

type Text = (typeof content)["en"];

function errorMessage(error: AuthError | Error, text: Text) {
    const code = "code" in error ? (error as AuthError).code : undefined;
    if (code === "invalid_credentials") return text.errors.invalid_credentials;
    if (code === "email_not_confirmed") return text.errors.email_not_confirmed;
    if (code === "user_already_exists" || code === "email_exists") return text.errors.user_already_exists;
    if (code === "weak_password") return text.errors.weak_password;
    if (code?.startsWith("over_") || ("status" in error && (error as AuthError).status === 429)) return text.errors.rate_limit;
    return text.errors.generic;
}

const primaryButton =
    "w-full rounded-lg bg-[#7a3b2e] px-6 py-3 font-medium text-white transition hover:bg-[#6b2516] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a3b2e]";
const textLink = "font-medium text-[#7a3b2e] underline-offset-4 hover:underline";

function AuthForms({ locale }: { locale: string }) {
    const text = content[locale as keyof typeof content] || content.en;
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = safeRedirect(searchParams.get("redirect"), locale);
    const reason = searchParams.get("reason") as AuthReason | null;

    const initialMode: Mode =
        searchParams.get("mode") === "signup" ? "signup" : searchParams.get("mode") === "reset" ? "reset" : "signin";
    const [mode, setMode] = useState<Mode>(initialMode);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [recoveryReady, setRecoveryReady] = useState(false);

    const signInForm = useForm<SignInFormData>({ resolver: zodResolver(signInSchema(locale)) });
    const signUpForm = useForm<SignUpFormData>({ resolver: zodResolver(signUpSchema(locale)) });
    const forgotForm = useForm<ForgotPasswordFormData>({ resolver: zodResolver(forgotPasswordSchema(locale)) });
    const resetForm = useForm<NewPasswordFormData>({ resolver: zodResolver(newPasswordSchema(locale)) });

    // A signed-in visitor has nothing to do here, except when completing a password reset.
    // The reset link signs the visitor in and fires PASSWORD_RECOVERY.
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
            if (event === "PASSWORD_RECOVERY") {
                setMode("reset");
                setRecoveryReady(true);
                return;
            }
            if (initialMode === "reset") {
                if (session) setRecoveryReady(true);
                return;
            }
            if (session && event !== "SIGNED_OUT") router.replace(redirectTo);
        });
        return () => subscription.unsubscribe();
    }, [initialMode, redirectTo, router]);

    const switchMode = (next: Mode) => {
        setMode(next);
        setError(null);
        setNotice(null);
    };

    const onSignIn = async (data: SignInFormData) => {
        setError(null);
        const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
        if (error) return setError(errorMessage(error, text));
        router.replace(redirectTo);
    };

    const onSignUp = async (data: SignUpFormData) => {
        setError(null);
        const { data: result, error } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: { full_name: data.fullName },
                emailRedirectTo: `${window.location.origin}${redirectTo}`,
            },
        });
        if (error) return setError(errorMessage(error, text));
        if (result.session) {
            router.replace(redirectTo);
            return;
        }
        // With email confirmation on, an existing address comes back as a user with no identities.
        if (result.user && result.user.identities?.length === 0) {
            setError(text.errors.user_already_exists);
            return;
        }
        signUpForm.reset();
        setNotice(text.checkInbox(data.email));
        setMode("signin");
    };

    const onForgot = async (data: ForgotPasswordFormData) => {
        setError(null);
        const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
            redirectTo: `${window.location.origin}/${locale}/auth?mode=reset`,
        });
        if (error) return setError(errorMessage(error, text));
        setNotice(text.resetSent(data.email));
    };

    const onReset = async (data: NewPasswordFormData) => {
        setError(null);
        const { error } = await supabase.auth.updateUser({ password: data.password });
        if (error) return setError(errorMessage(error, text));
        setNotice(text.passwordUpdated);
        router.replace(`/${locale}/settings`);
    };

    const title = {
        signin: text.signInTitle,
        signup: text.signUpTitle,
        forgot: text.forgotTitle,
        reset: text.resetTitle,
    }[mode];

    const pending =
        signInForm.formState.isSubmitting ||
        signUpForm.formState.isSubmitting ||
        forgotForm.formState.isSubmitting ||
        resetForm.formState.isSubmitting;

    return (
        <div className="w-full max-w-md">
            {reason && text.reasons[reason] && (mode === "signin" || mode === "signup") && (
                <p className="mb-5 rounded-lg border border-[#e7d6cf] bg-[#fbf6f3] px-4 py-3 text-sm text-[#5b3328]">
                    {text.reasons[reason]}
                </p>
            )}

            <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
                {(mode === "signin" || mode === "signup") && (
                    <div className="mb-6 grid grid-cols-2 rounded-lg bg-gray-100 p-1 text-sm" role="tablist">
                        {(["signin", "signup"] as const).map((m) => (
                            <button
                                key={m}
                                type="button"
                                role="tab"
                                aria-selected={mode === m}
                                onClick={() => switchMode(m)}
                                className={`rounded-md py-2 font-medium transition ${
                                    mode === m ? "bg-white text-[#7a3b2e] shadow-sm" : "text-gray-600 hover:text-gray-900"
                                }`}
                            >
                                {m === "signin" ? text.signInTab : text.signUpTab}
                            </button>
                        ))}
                    </div>
                )}

                <h1 className="mb-5 text-2xl font-semibold text-[#2b1a16]">{title}</h1>

                {notice && (
                    <p role="status" className="mb-5 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
                        {notice}
                    </p>
                )}
                {error && (
                    <p role="alert" className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </p>
                )}

                {mode === "signin" && (
                    <form onSubmit={signInForm.handleSubmit(onSignIn)} className="space-y-4" noValidate>
                        <FormInput label={text.email} name="email" type="email" register={signInForm.register} error={signInForm.formState.errors.email} />
                        <FormInput label={text.password} name="password" type="password" register={signInForm.register} error={signInForm.formState.errors.password} />
                        <div className="text-end text-sm">
                            <button type="button" onClick={() => switchMode("forgot")} className={textLink}>
                                {text.forgotLink}
                            </button>
                        </div>
                        <button type="submit" disabled={pending} className={primaryButton}>
                            {pending ? text.working : text.signInButton}
                        </button>
                    </form>
                )}

                {mode === "signup" && (
                    <form onSubmit={signUpForm.handleSubmit(onSignUp)} className="space-y-4" noValidate>
                        <FormInput label={text.fullName} name="fullName" register={signUpForm.register} error={signUpForm.formState.errors.fullName} />
                        <FormInput label={text.email} name="email" type="email" register={signUpForm.register} error={signUpForm.formState.errors.email} />
                        <FormInput label={text.password} name="password" type="password" register={signUpForm.register} error={signUpForm.formState.errors.password} />
                        <FormInput label={text.confirmPassword} name="confirmPassword" type="password" register={signUpForm.register} error={signUpForm.formState.errors.confirmPassword} />
                        <button type="submit" disabled={pending} className={primaryButton}>
                            {pending ? text.working : text.signUpButton}
                        </button>
                    </form>
                )}

                {mode === "forgot" && (
                    <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4" noValidate>
                        <FormInput label={text.email} name="email" type="email" register={forgotForm.register} error={forgotForm.formState.errors.email} />
                        <button type="submit" disabled={pending} className={primaryButton}>
                            {pending ? text.working : text.forgotButton}
                        </button>
                        <button type="button" onClick={() => switchMode("signin")} className={`block text-sm ${textLink}`}>
                            {text.backToSignIn}
                        </button>
                    </form>
                )}

                {mode === "reset" &&
                    (recoveryReady ? (
                        <form onSubmit={resetForm.handleSubmit(onReset)} className="space-y-4" noValidate>
                            <FormInput label={text.newPassword} name="password" type="password" register={resetForm.register} error={resetForm.formState.errors.password} />
                            <FormInput label={text.confirmPassword} name="confirmPassword" type="password" register={resetForm.register} error={resetForm.formState.errors.confirmPassword} />
                            <button type="submit" disabled={pending} className={primaryButton}>
                                {pending ? text.working : text.resetButton}
                            </button>
                        </form>
                    ) : (
                        <ResetLinkFallback text={text} onRequestNew={() => switchMode("forgot")} />
                    ))}
            </div>
        </div>
    );
}

// Shown when /auth?mode=reset is opened without a valid recovery session.
function ResetLinkFallback({ text, onRequestNew }: { text: Text; onRequestNew: () => void }) {
    const [expired, setExpired] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setExpired(true), 2500);
        return () => clearTimeout(timer);
    }, []);
    if (!expired) return <p className="text-sm text-gray-500">{text.working}</p>;
    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-700">{text.resetLinkInvalid}</p>
            <button type="button" onClick={onRequestNew} className={primaryButton}>
                {text.forgotButton}
            </button>
        </div>
    );
}

export default function AuthPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = use(params);
    const dir = useMemo(() => (isRTL(locale) ? "rtl" : "ltr"), [locale]);

    return (
        <main dir={dir} className="flex min-h-[70vh] items-start justify-center bg-white px-4 py-12 sm:py-16">
            <Suspense>
                <AuthForms locale={locale} />
            </Suspense>
        </main>
    );
}
