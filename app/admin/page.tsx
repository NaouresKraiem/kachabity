"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
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
            <p>Redirecting to admin dashboard...</p>
        </div>
    );
}

