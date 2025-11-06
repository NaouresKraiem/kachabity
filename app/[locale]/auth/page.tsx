"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import FormInput from "@/components/forms/FormInput";
import { useLanguage } from "@/lib/language-context";
import supabase from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import Footer from "@/components/footer/Footer";
import {
    signInSchema,
    registerSchema,
    resetPasswordSchema,
    type SignInFormData,
    type RegisterFormData,
    type ResetPasswordFormData
} from "@/lib/schemas/auth-schema";

// Custom toast notification function
const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;

    // Add animation keyframes
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Language-specific content
const authContent = {
    en: {
        title: "Sign In / Register",
        subtitle: "Welcome to Kachabiti",
        backToHome: " ",
        signInTitle: "Sign In",
        registerTitle: "Create Account",
        resetPasswordTitle: "Reset Password",
        email: "Email Address",
        password: "Password",
        confirmPassword: "Confirm Password",
        newPassword: "New Password",
        confirmNewPassword: "Confirm New Password",
        firstName: "First Name",
        lastName: "Last Name",
        phone: "Phone Number",
        signInButton: "Sign In",
        registerButton: "Create Account",
        resetPasswordButton: "Reset Password",
        forgotPassword: "Forgot Password?",
        alreadyHaveAccount: "Already have an account?",
        dontHaveAccount: "Don't have an account?",
        signInWith: "Or sign in with",
        registerWith: "Or register with",
        backToSignIn: "Sign In",
        terms: "By creating an account, you agree to our Terms of Service and Privacy Policy"
    },
    fr: {
        title: "Connexion / Inscription",
        subtitle: "Bienvenue chez Artisan par Kraiem",
        backToHome: "Retour à l'accueil",
        signInTitle: "Se connecter",
        registerTitle: "Créer un compte",
        resetPasswordTitle: "Réinitialiser le mot de passe",
        email: "Adresse e-mail",
        password: "Mot de passe",
        confirmPassword: "Confirmer le mot de passe",
        newPassword: "Nouveau mot de passe",
        confirmNewPassword: "Confirmer le nouveau mot de passe",
        firstName: "Prénom",
        lastName: "Nom",
        phone: "Numéro de téléphone",
        signInButton: "Se connecter",
        registerButton: "Créer un compte",
        resetPasswordButton: "Réinitialiser",
        forgotPassword: "Mot de passe oublié?",
        alreadyHaveAccount: "Vous avez déjà un compte?",
        dontHaveAccount: "Vous n'avez pas de compte?",
        signInWith: "Ou se connecter avec",
        registerWith: "Ou s'inscrire avec",
        backToSignIn: "Connexion",
        terms: "En créant un compte, vous acceptez nos Conditions d'utilisation et notre Politique de confidentialité"
    },
    ar: {
        title: "تسجيل الدخول / التسجيل",
        subtitle: "مرحباً بك في حرفي من قبل كريم",
        backToHome: "العودة للرئيسية",
        signInTitle: "تسجيل الدخول",
        registerTitle: "إنشاء حساب",
        resetPasswordTitle: "إعادة تعيين كلمة المرور",
        email: "عنوان البريد الإلكتروني",
        password: "كلمة المرور",
        confirmPassword: "تأكيد كلمة المرور",
        newPassword: "كلمة المرور الجديدة",
        confirmNewPassword: "تأكيد كلمة المرور الجديدة",
        firstName: "الاسم الأول",
        lastName: "اسم العائلة",
        phone: "رقم الهاتف",
        signInButton: "تسجيل الدخول",
        registerButton: "إنشاء حساب",
        resetPasswordButton: "إعادة التعيين",
        forgotPassword: "نسيت كلمة المرور؟",
        alreadyHaveAccount: "لديك حساب بالفعل؟",
        dontHaveAccount: "ليس لديك حساب؟",
        signInWith: "أو تسجيل الدخول باستخدام",
        registerWith: "أو التسجيل باستخدام",
        backToSignIn: " تسجيل الدخول",
        terms: "بإنشاء حساب، فإنك توافق على شروط الخدمة وسياسة الخصوصية الخاصة بنا"
    }
};

export default function AuthPage() {
    const { locale } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isSignIn, setIsSignIn] = useState(true);
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    const content = authContent[locale as keyof typeof authContent] || authContent.en;

    // Form setup for Sign In
    const signInForm = useForm<SignInFormData>({
        resolver: zodResolver(signInSchema),
        mode: "onBlur"
    });

    // Form setup for Register
    const registerForm = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        mode: "onBlur"
    });

    // Form setup for Password Reset
    const resetForm = useForm<ResetPasswordFormData>({
        resolver: zodResolver(resetPasswordSchema),
        mode: "onBlur"
    });

    // Check if user is coming from password reset email
    useEffect(() => {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');

        if (type === 'recovery') {
            setIsResettingPassword(true);
        }
    }, []);

    // Handle Sign In
    const handleSignIn = async (data: SignInFormData) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: data.email,
                password: data.password,
            });
            if (error) throw error;
            showToast("Welcome back!", 'success');
            const redirect = searchParams.get('redirect') || `/${locale}/settings`;
            router.replace(redirect);
        } catch (err: unknown) {
            const error = err as { message?: string };
            showToast(error?.message || "Authentication failed", 'error');
        }
    };

    // Handle Register
    const handleRegister = async (data: RegisterFormData) => {
        try {
            const { error } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: {
                    data: {
                        first_name: data.firstName,
                        last_name: data.lastName,
                        phone: data.phone,
                    },
                    emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/${locale}` : undefined,
                },
            });
            if (error) throw error;
            showToast("Account created successfully! Please check your email to verify.", 'success');
            const redirect = searchParams.get('redirect') || `/${locale}/settings`;
            router.replace(redirect);
        } catch (err: unknown) {
            const error = err as { message?: string };
            showToast(error?.message || "Authentication failed", 'error');
        }
    };

    // Handle Password Reset
    const handlePasswordReset = async (data: ResetPasswordFormData) => {
        try {
            const { error } = await supabase.auth.updateUser({
                password: data.newPassword
            });
            if (error) throw error;
            showToast("Password updated successfully!", 'success');
            setTimeout(() => {
                setIsResettingPassword(false);
                setIsSignIn(true);
                router.push(`/${locale}/auth`);
            }, 2000);
        } catch (err: unknown) {
            const error = err as { message?: string };
            showToast(error?.message || "Failed to reset password", 'error');
        }
    };

    return (
        <>
            <div className="min-h-screen bg-linear-to-b from-white via-gray-50 to-gray-100 flex items-center justify-center relative overflow-hidden">
                {/* Subtle Background Pattern */}
                <div className="absolute inset-0 opacity-[0.03]">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `radial-gradient(circle at 1px 1px, #842E1B 1px, transparent 0)`,
                        backgroundSize: '40px 40px'
                    }} />
                </div>

                {/* Subtle Accent Shapes */}
                <div className="absolute top-20 right-10 w-64 h-64 bg-[#842E1B] opacity-[0.04] rounded-full blur-3xl" />
                <div className="absolute bottom-20 left-10 w-72 h-72 bg-[#7a3b2e] opacity-[0.04] rounded-full blur-3xl" />

                {/* Back to Home Button */}
                <button
                    onClick={() => router.push(`/${locale}`)}
                    className="absolute top-6 left-6 flex items-center gap-2 text-gray-600 hover:text-[#842E1B] transition-all duration-300 group z-20"
                    aria-label="Back to home"
                >
                    <svg
                        className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span className="font-medium text-sm">{content.backToHome}</span>
                </button>

                <div className="max-w-7xl w-full mx-auto px-4 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center min-h-[600px]">
                        {/* Left Side - Logo & Branding */}
                        <div className="hidden lg:flex flex-col items-center justify-center space-y-8 animate-slideLeft">
                            <div className="relative group">
                                <div className="absolute inset-0 bg-[#842E1B] opacity-20 rounded-full blur-3xl group-hover:opacity-30 transition-opacity duration-500" />
                                <Image
                                    src="/assets/images/logoKachabitybg.png"
                                    alt="Kachabity Logo"
                                    width={320}
                                    height={320}
                                    className="relative z-10 drop-shadow-2xl group-hover:scale-105 transition-transform duration-500"
                                />
                            </div>
                            <div className="text-center space-y-4 animate-fadeIn" style={{ animationDelay: '0.3s' }}>
                                <h1 className="text-4xl font-bold text-[#2b1a16]">
                                    {content.subtitle}
                                </h1>
                                <p className="text-lg text-[#7a3b2e]/80 max-w-md mx-auto">
                                    Discover authentic handcrafted traditional products
                                </p>
                            </div>
                        </div>

                        {/* Right Side - Auth Form */}
                        <div className="w-full max-w-md mx-auto lg:mx-0 animate-slideRight">
                            {/* Mobile Logo */}
                            <div className="lg:hidden flex justify-center mb-8">
                                <Image
                                    src="/assets/images/logoKachabitybg.png"
                                    alt="Kachabity Logo"
                                    width={100}
                                    height={100}
                                    className="drop-shadow-lg"
                                />
                            </div>

                            {/* Animated Gradient Border Wrapper */}
                            <div className="relative mt-10 mb-10 rounded-3xl shadow-2xl">
                                {/* <div className="absolute inset-0 rounded-3xl animate-border-spin" style={{
                                    background: 'linear-gradient(60deg, #842E1B, #D4845F, #B8956A, #842E1B)',
                                    padding: '3px'
                                }}>
                                    <div className="bg-white rounded-3xl h-full w-full"></div>
                                </div> */}
                                <div className="bg-white rounded-3xl p-8 lg:p-10 relative z-10">
                                    {/* Reset Password Title */}
                                    {isResettingPassword ? (
                                        <div className="mb-8">
                                            <h2 className="text-2xl font-bold text-[#2b1a16] text-center mb-2">
                                                {content.resetPasswordTitle}
                                            </h2>
                                            <p className="text-sm text-gray-600 text-center">
                                                Enter your new password below
                                            </p>
                                        </div>
                                    ) : (
                                        /* Toggle Buttons */
                                        <div className="flex mb-8 bg-linear-to-r from-[#FCF4F2] to-[#F6EDEA] rounded-xl p-1.5 relative">
                                            <div
                                                className="absolute top-1.5 h-[calc(100%-12px)] bg-white rounded-lg shadow-md transition-all duration-300 ease-in-out"
                                                style={{
                                                    width: 'calc(50% - 6px)',
                                                    left: isSignIn ? '6px' : 'calc(50% + 0px)',
                                                }}
                                            />
                                            <button
                                                onClick={() => setIsSignIn(true)}
                                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-300 relative z-10 ${isSignIn
                                                    ? 'text-[#842E1B]'
                                                    : 'text-gray-600 hover:text-gray-800'
                                                    }`}
                                            >
                                                {content.signInTitle}
                                            </button>
                                            <button
                                                onClick={() => setIsSignIn(false)}
                                                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-300 relative z-10 ${!isSignIn
                                                    ? 'text-[#842E1B]'
                                                    : 'text-gray-600 hover:text-gray-800'
                                                    }`}
                                            >
                                                {content.registerTitle}
                                            </button>
                                        </div>
                                    )}

                                    {/* Form */}
                                    {isResettingPassword ? (
                                        /* Password Reset Form */
                                        <form onSubmit={resetForm.handleSubmit(handlePasswordReset)} className="space-y-4">
                                            <FormInput
                                                label={content.newPassword}
                                                name="newPassword"
                                                type="password"
                                                placeholder="Enter new password (min 6 characters)"
                                                register={resetForm.register}
                                                error={resetForm.formState.errors.newPassword}
                                                required
                                            />

                                            <FormInput
                                                label={content.confirmNewPassword}
                                                name="confirmNewPassword"
                                                type="password"
                                                placeholder="Confirm new password"
                                                register={resetForm.register}
                                                error={resetForm.formState.errors.confirmNewPassword}
                                                required
                                            />

                                            <button
                                                type="submit"
                                                className="w-full bg-linear-to-r from-[#842E1B] to-[#7a3b2e] text-white py-3 px-4 rounded-lg font-medium hover:from-[#6b2516] hover:to-[#5e2d23] transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                                            >
                                                {content.resetPasswordButton}
                                            </button>

                                            {/* Back to Sign In Link */}
                                            <div className="text-center mt-4">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsResettingPassword(false);
                                                        setIsSignIn(true);
                                                        router.push(`/${locale}/auth`);
                                                    }}
                                                    className="text-sm text-[#7a3b2e] hover:text-[#5e2d23] font-medium transition"
                                                >
                                                    ← {content.backToSignIn}
                                                </button>
                                            </div>
                                        </form>
                                    ) : isSignIn ? (
                                        /* Sign In Form */
                                        <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
                                            <FormInput
                                                label={content.email}
                                                name="email"
                                                type="email"
                                                register={signInForm.register}
                                                error={signInForm.formState.errors.email}
                                                required
                                            />

                                            <FormInput
                                                label={content.password}
                                                name="password"
                                                type="password"
                                                register={signInForm.register}
                                                error={signInForm.formState.errors.password}
                                                required
                                            />

                                            <div className="text-right">
                                                <button
                                                    type="button"
                                                    className="text-sm text-[#7a3b2e] hover:text-[#5e2d23] transition"
                                                    onClick={async () => {
                                                        const email = signInForm.getValues('email');
                                                        if (!email) {
                                                            showToast('Enter your email first', 'error');
                                                            return;
                                                        }
                                                        try {
                                                            await supabase.auth.resetPasswordForEmail(email, {
                                                                redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/${locale}/auth` : undefined,
                                                            });
                                                            showToast('Password reset email sent! Check your inbox.', 'success');
                                                        } catch (e: unknown) {
                                                            const error = e as { message?: string };
                                                            showToast(error?.message || 'Failed to send reset email', 'error');
                                                        }
                                                    }}
                                                >
                                                    {content.forgotPassword}
                                                </button>
                                            </div>

                                            <button
                                                type="submit"
                                                className="w-full bg-linear-to-r from-[#842E1B] to-[#7a3b2e] text-white py-3 px-4 rounded-lg font-medium hover:from-[#6b2516] hover:to-[#5e2d23] transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                                            >
                                                {content.signInButton}
                                            </button>
                                        </form>
                                    ) : (
                                        /* Register Form */
                                        <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormInput
                                                    label={content.firstName}
                                                    name="firstName"
                                                    type="text"
                                                    register={registerForm.register}
                                                    error={registerForm.formState.errors.firstName}
                                                    required
                                                />

                                                <FormInput
                                                    label={content.lastName}
                                                    name="lastName"
                                                    type="text"
                                                    register={registerForm.register}
                                                    error={registerForm.formState.errors.lastName}
                                                    required
                                                />
                                            </div>

                                            <FormInput
                                                label={content.phone}
                                                name="phone"
                                                type="tel"
                                                register={registerForm.register}
                                                error={registerForm.formState.errors.phone}
                                                required
                                            />

                                            <FormInput
                                                label={content.email}
                                                name="email"
                                                type="email"
                                                register={registerForm.register}
                                                error={registerForm.formState.errors.email}
                                                required
                                            />

                                            <FormInput
                                                label={content.password}
                                                name="password"
                                                type="password"
                                                register={registerForm.register}
                                                error={registerForm.formState.errors.password}
                                                required
                                            />

                                            <FormInput
                                                label={content.confirmPassword}
                                                name="confirmPassword"
                                                type="password"
                                                register={registerForm.register}
                                                error={registerForm.formState.errors.confirmPassword}
                                                required
                                            />

                                            <button
                                                type="submit"
                                                className="w-full bg-linear-to-r from-[#842E1B] to-[#7a3b2e] text-white py-3 px-4 rounded-lg font-medium hover:from-[#6b2516] hover:to-[#5e2d23] transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                                            >
                                                {content.registerButton}
                                            </button>
                                        </form>
                                    )}

                                    {/* Social Login - Only for Sign In/Register */}
                                    {!isResettingPassword && (
                                        <div className="mt-6">
                                            <div className="relative">
                                                <div className="absolute inset-0 flex items-center">
                                                    <div className="w-full border-t border-gray-300" />
                                                </div>
                                                <div className="relative flex justify-center text-sm">
                                                    <span className="px-2 bg-white text-gray-500">
                                                        {isSignIn ? content.signInWith : content.registerWith}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-6 grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            const redirect = searchParams.get('redirect') || `/${locale}/settings`;
                                                            // Callback URL should point to the API route that will handle the OAuth callback
                                                            const callbackUrl = typeof window !== 'undefined'
                                                                ? `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirect)}`
                                                                : undefined;

                                                            const { error } = await supabase.auth.signInWithOAuth({
                                                                provider: 'google',
                                                                options: {
                                                                    redirectTo: callbackUrl,
                                                                    queryParams: {
                                                                        access_type: 'offline',
                                                                        prompt: 'consent',
                                                                    }
                                                                }
                                                            });
                                                            if (error) throw error;
                                                        } catch (e: unknown) {
                                                            const err = e as { message?: string };
                                                            showToast(err?.message || 'Google sign-in failed', 'error');
                                                        }
                                                    }}
                                                    className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                                                >
                                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                                    </svg>
                                                    <span className="ml-2">Google</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            const redirect = searchParams.get('redirect') || `/${locale}/settings`;
                                                            const callbackUrl = typeof window !== 'undefined'
                                                                ? `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirect)}`
                                                                : undefined;

                                                            const { error } = await supabase.auth.signInWithOAuth({
                                                                provider: 'facebook',
                                                                options: {
                                                                    redirectTo: callbackUrl,
                                                                }
                                                            });
                                                            if (error) throw error;
                                                        } catch (e: unknown) {
                                                            const err = e as { message?: string };
                                                            showToast(err?.message || 'Facebook sign-in failed', 'error');
                                                        }
                                                    }}
                                                    className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                                                >
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                                    </svg>
                                                    <span className="ml-2">Facebook</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Terms */}
                                    {!isSignIn && !isResettingPassword && (
                                        <p className="mt-6 text-xs text-gray-500 text-center">
                                            {content.terms}
                                        </p>
                                    )}

                                    {/* Toggle Link */}
                                    {!isResettingPassword && (
                                        <div className="mt-6 text-center">
                                            <span className="text-gray-600">
                                                {isSignIn ? content.dontHaveAccount : content.alreadyHaveAccount}
                                            </span>
                                            <button
                                                onClick={() => setIsSignIn(!isSignIn)}
                                                className="ml-1 text-[#7a3b2e] hover:text-[#5e2d23] font-medium"
                                            >
                                                {isSignIn ? content.registerTitle : content.signInTitle}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Animations */}
            <style jsx>{`
                    @keyframes fadeIn {
                        from {
                            opacity: 0;
                        }
                        to {
                            opacity: 1;
                        }
                    }

                    @keyframes slideDown {
                        from {
                            opacity: 0;
                            transform: translateY(-20px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }

                    @keyframes slideUp {
                        from {
                            opacity: 0;
                            transform: translateY(30px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }

                @keyframes border-spin {
                    0% {
                        transform: rotate(0deg);
                    }
                    100% {
                        transform: rotate(360deg);
                    }
                }

                .animate-fadeIn {
                    animation: fadeIn 0.6s ease-out;
                }

                .animate-slideDown {
                    animation: slideDown 0.6s ease-out;
                }

                .animate-slideUp {
                    animation: slideUp 0.7s ease-out;
                }

                .animate-border-spin {
                    animation: border-spin 4s linear infinite;
                }
                `}</style>

            <Footer />
        </>
    );
}
