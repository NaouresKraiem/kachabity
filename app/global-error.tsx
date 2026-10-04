"use client";

// Shown when the app crashes outside any page's own error handling. It replaces the
// root layout, so it renders its own <html> and can't know the visitor's locale.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="ar">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#ffffff",
                    color: "#2b1a16",
                    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
                    padding: 16,
                }}
            >
                <main style={{ maxWidth: 420, textAlign: "center", lineHeight: 1.6 }}>
                    <p dir="rtl" style={{ fontSize: 20, fontWeight: 600, margin: "0 0 4px" }}>حدث خطأ غير متوقع</p>
                    <p style={{ margin: "0 0 4px" }}>Une erreur inattendue s&apos;est produite.</p>
                    <p style={{ margin: "0 0 24px", color: "#6f5f57" }}>Something went wrong.</p>
                    <button
                        type="button"
                        onClick={() => reset()}
                        style={{
                            background: "#7a3b2e",
                            color: "#ffffff",
                            border: 0,
                            borderRadius: 999,
                            padding: "12px 28px",
                            fontSize: 15,
                            cursor: "pointer",
                        }}
                    >
                        إعادة المحاولة · Réessayer · Try again
                    </button>
                </main>
            </body>
        </html>
    );
}
