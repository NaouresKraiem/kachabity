"use client";

import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/auth-js";
import supabase from "@/lib/supabaseClient";

// Why a visitor was sent to the login page; the page explains it in a banner.
export type AuthReason = "favorites" | "review" | "account";

/** Login page URL that returns the visitor to `redirect` afterwards. */
export function authHref(locale: string, options: { redirect?: string; reason?: AuthReason; mode?: "signup" } = {}) {
    const params = new URLSearchParams();
    if (options.redirect) params.set("redirect", options.redirect);
    if (options.reason) params.set("reason", options.reason);
    if (options.mode) params.set("mode", options.mode);
    const query = params.toString();
    return `/${locale}/auth${query ? `?${query}` : ""}`;
}

/** The page the visitor is on now, used as the post-login redirect. */
export function currentPath() {
    if (typeof window === "undefined") return undefined;
    return window.location.pathname + window.location.search;
}

/** Only same-site paths are allowed as a post-login redirect. */
export function safeRedirect(path: string | null, locale: string) {
    return path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/auth") && !path.includes("/auth?")
        ? path
        : `/${locale}/settings`;
}

/** Storefront customer session (localStorage-backed Supabase client). */
export function useCustomer() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
            if (!active) return;
            setUser(data.session?.user ?? null);
            setLoading(false);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });
        return () => {
            active = false;
            subscription.unsubscribe();
        };
    }, []);

    return { user, loading };
}

/** Display name for a customer: the name they entered at sign-up, else their email's local part. */
export function customerName(user: User | null) {
    if (!user) return "";
    const meta = user.user_metadata || {};
    return (meta.full_name || meta.name || user.email?.split("@")[0] || "").trim();
}

/** Sends a logged-out visitor to the login page, returning them here afterwards. */
export function goToLogin(locale: string, reason: AuthReason) {
    window.location.assign(authHref(locale, { redirect: currentPath(), reason }));
}
