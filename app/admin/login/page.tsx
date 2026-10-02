"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { createAdminBrowserClient } from "@/lib/supabase-browser";
import { useAdminT } from "@/lib/admin-i18n";
import AdminLanguageSwitcher from "@/components/admin/AdminLanguageSwitcher";

const { Title, Text } = Typography;

type LoginValues = { email: string; password: string };

// Role of the signed-in user as middleware sees it, or null. Retried once because a slow
// connection to Supabase can make a single check fail.
async function fetchBackOfficeRole(): Promise<{ data?: { role?: string } } | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch("/api/admin/me").catch(() => null);
        if (res?.ok) return res.json();
    }
    return null;
}

// Only allow redirects back into the admin area.
function safeNextPath(next: string | null): string {
    return next && next.startsWith("/admin/") && !next.startsWith("//") ? next : "/admin/dashboard";
}

function AdminLoginForm() {
    const { t } = useAdminT();
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = useMemo(() => createAdminBrowserClient(), []);
    const nextPath = safeNextPath(searchParams.get("next"));

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

    // Landing here while signed in usually means middleware couldn't verify the session on
    // that request (e.g. a slow connection to Supabase). Ask the server before calling the
    // account "not allowed", and continue if it does have back-office access.
    useEffect(() => {
        let cancelled = false;
        supabase.auth.getUser().then(async ({ data }: { data: { user: { email?: string } | null } }) => {
            const email = data.user?.email ?? null;
            if (!email || cancelled) return;
            const me = await fetchBackOfficeRole();
            if (cancelled) return;
            if (me?.data?.role) {
                router.replace(nextPath);
                router.refresh();
            } else {
                setSignedInEmail(email);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [supabase, router, nextPath]);

    const handleSubmit = async ({ email, password }: LoginValues) => {
        setSubmitting(true);
        setError(null);
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
            setError(signInError.message);
            setSubmitting(false);
            return;
        }
        // Confirm access before leaving, so a refused account gets a clear message here.
        const me = await fetchBackOfficeRole();
        if (!me?.data?.role) {
            setSignedInEmail(email);
            setSubmitting(false);
            return;
        }
        router.replace(nextPath);
        router.refresh();
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setSignedInEmail(null);
    };

    return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f6fa", padding: 16 }}>
            <Card style={{ width: "100%", maxWidth: 400 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <Title level={3} style={{ margin: 0 }}>{t("Kachabity admin")}</Title>
                    <AdminLanguageSwitcher />
                </div>
                <Text type="secondary">{t("Sign in with your admin or staff account.")}</Text>

                {signedInEmail && (
                    <Alert
                        style={{ marginTop: 16 }}
                        type="warning"
                        showIcon
                        title={t("{signedInEmail} doesn't have access to the admin. Ask an admin to add it in Team.", { signedInEmail })}
                        action={<Button size="small" onClick={handleSignOut}>{t("Sign out")}</Button>}
                    />
                )}
                {error && <Alert style={{ marginTop: 16 }} type="error" showIcon title={error} />}

                <Form<LoginValues> layout="vertical" onFinish={handleSubmit} style={{ marginTop: 24 }} requiredMark={false}>
                    <Form.Item label={t("Email")} name="email" rules={[{ required: true, type: "email" }]}>
                        <Input autoComplete="email" />
                    </Form.Item>
                    <Form.Item label={t("Password")} name="password" rules={[{ required: true }]}>
                        <Input.Password autoComplete="current-password" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block loading={submitting} style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}>
                        {t("Sign in")}
                    </Button>
                </Form>
            </Card>
        </div>
    );
}

export default function AdminLoginPage() {
    return (
        <Suspense>
            <AdminLoginForm />
        </Suspense>
    );
}
