"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AdminRole, Permission } from "@/lib/admin-auth";

interface AdminRoleState {
    id: string | null;
    role: AdminRole | null;
    email: string | null;
    permissions: Permission[];
    loading: boolean;
}

const EMPTY: AdminRoleState = { id: null, role: null, email: null, permissions: [], loading: true };
const AdminRoleContext = createContext<AdminRoleState>(EMPTY);

/**
 * Role and permissions of the signed-in back-office user, used to hide controls they can't use.
 * Middleware enforces the same rules on every request; this is only for the UI.
 */
export function AdminRoleProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AdminRoleState>(EMPTY);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/admin/me")
            .then((res) => (res.ok ? res.json() : null))
            .then((json) => {
                if (!cancelled) setState({ id: json?.data?.id ?? null, role: json?.data?.role ?? null, email: json?.data?.email ?? null, permissions: json?.data?.permissions ?? [], loading: false });
            })
            .catch(() => {
                if (!cancelled) setState({ ...EMPTY, loading: false });
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
        /** Owners and admins: full access. */
        isAdmin: state.role === "admin" || state.role === "owner",
        isOwner: state.role === "owner",
        can: (permission: Permission) => state.permissions.includes(permission),
    };
}
