"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { createAdminBrowserClient } from "@/lib/supabase-browser";

const { Title, Text } = Typography;

type LoginValues = { email: string; password: string };

// Only allow redirects back into the admin area.
function safeNextPath(next: string | null): string {
    return next && next.startsWith("/admin/") && !next.startsWith("//") ? next : "/admin/dashboard";
}

function AdminLoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = useMemo(() => createAdminBrowserClient(), []);
    const nextPath = safeNextPath(searchParams.get("next"));

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

    // Landing here while signed in means middleware rejected this account.
    useEffect(() => {
        supabase.auth.getUser().then(({ data }: { data: { user: { email?: string } | null } }) =>
            setSignedInEmail(data.user?.email ?? null)
        );
    }, [supabase]);

    const handleSubmit = async ({ email, password }: LoginValues) => {
        setSubmitting(true);
        setError(null);
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
            setError(signInError.message);
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
                <Title level={3} style={{ marginTop: 0 }}>Kachabity admin</Title>
                <Text type="secondary">Sign in with an admin account.</Text>

                {signedInEmail && (
                    <Alert
                        style={{ marginTop: 16 }}
                        type="warning"
                        showIcon
                        message={`${signedInEmail} is not an admin account.`}
                        action={<Button size="small" onClick={handleSignOut}>Sign out</Button>}
                    />
                )}
                {error && <Alert style={{ marginTop: 16 }} type="error" showIcon message={error} />}

                <Form<LoginValues> layout="vertical" onFinish={handleSubmit} style={{ marginTop: 24 }} requiredMark={false}>
                    <Form.Item label="Email" name="email" rules={[{ required: true, type: "email" }]}>
                        <Input autoComplete="email" />
                    </Form.Item>
                    <Form.Item label="Password" name="password" rules={[{ required: true }]}>
                        <Input.Password autoComplete="current-password" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block loading={submitting} style={{ background: "#7a3b2e", borderColor: "#7a3b2e" }}>
                        Sign in
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
