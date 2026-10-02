"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AdminRole, Permission } from "@/lib/admin-auth";

interface AdminRoleState {
    role: AdminRole | null;
    email: string | null;
    permissions: Permission[];
    loading: boolean;
}

const AdminRoleContext = createContext<AdminRoleState>({ role: null, email: null, permissions: [], loading: true });

/**
 * Role and permissions of the signed-in back-office user, used to hide controls they can't use.
 * Middleware enforces the same rules on every request; this is only for the UI.
 */
export function AdminRoleProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AdminRoleState>({ role: null, email: null, permissions: [], loading: true });

    useEffect(() => {
        let cancelled = false;
        fetch("/api/admin/me")
            .then((res) => (res.ok ? res.json() : null))
            .then((json) => {
                if (!cancelled) setState({ role: json?.data?.role ?? null, email: json?.data?.email ?? null, permissions: json?.data?.permissions ?? [], loading: false });
            })
            .catch(() => {
                if (!cancelled) setState({ role: null, email: null, permissions: [], loading: false });
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return <AdminRoleContext.Provider value={state}>{children}</AdminRoleContext.Provider>;
}

export function useAdminRole() {
    const state = useContext(AdminRoleContext);
    return {
        ...state,
        isAdmin: state.role === "admin",
        can: (permission: Permission) => state.permissions.includes(permission),
    };
}
