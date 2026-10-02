"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminT } from "@/lib/admin-i18n";

export default function AdminPage() {
    const { t } = useAdminT();
    const router = useRouter();

    useEffect(() => {
        // Redirect to products page by default
        router.replace("/admin/dashboard");
    }, [router]);

    return (
        <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            minHeight: "100vh" 
        }}>
            <p>{t("Redirecting to admin dashboard...")}</p>
        </div>
    );
}

