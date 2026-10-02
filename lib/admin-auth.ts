type AuthUser = { email?: string | null; app_metadata?: Record<string, unknown> };

export type AdminRole = 'admin' | 'staff';

/**
 * What a staff member can be allowed to do. Admins implicitly have every permission,
 * plus team management, which can't be granted to staff.
 */
export const PERMISSIONS = {
    products: { label: 'Products', description: 'Create and edit products, categories, variants, colors and sizes' },
    stock: { label: 'Stock', description: 'See inventory, record movements and counts, manage locations and suppliers' },
    orders: { label: 'Orders', description: 'See and validate orders and change their status (validating deducts stock)' },
    discounts: { label: 'Discounts', description: 'Create and edit product discounts' },
    marketing: { label: 'Marketing', description: 'Sale banners, video reels and abandoned-cart emails' },
    analytics: { label: 'Analytics', description: 'Cart analytics on the dashboard' },
    costs: { label: 'Costs', description: 'See and edit purchase costs and stock value' },
    delete: { label: 'Delete', description: 'Delete records in the areas they can edit' },
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Staff accounts created before per-member permissions get what the Staff role used to allow. */
export const DEFAULT_STAFF_PERMISSIONS: Permission[] = ['products', 'stock', 'orders', 'marketing', 'analytics'];

/** Starting points offered in the Team page; each member's list can still be edited. */
export const PERMISSION_PRESETS: { label: string; permissions: Permission[] }[] = [
    { label: 'Staff', permissions: DEFAULT_STAFF_PERMISSIONS },
    { label: 'Stock clerk', permissions: ['stock'] },
    { label: 'Order manager', permissions: ['orders', 'stock'] },
    { label: 'Content editor', permissions: ['products', 'marketing', 'discounts'] },
];

const isPermission = (value: unknown): value is Permission =>
    typeof value === 'string' && (ALL_PERMISSIONS as string[]).includes(value);

/**
 * Back-office role of a signed-in user, or null for shoppers.
 * Only app_metadata is trusted: user_metadata is editable by the user themselves.
 * Emails in ADMIN_EMAILS are always admins.
 */
export function getAdminRole(user: AuthUser | null): AdminRole | null {
    if (!user) return null;

    const role = user.app_metadata?.role;
    if (role === 'admin') return 'admin';

    const allowedEmails = (process.env.ADMIN_EMAILS ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
    if (user.email && allowedEmails.includes(user.email.toLowerCase())) return 'admin';

    return role === 'staff' ? 'staff' : null;
}

/** Permissions of a back-office user: every one for admins, app_metadata.permissions for staff. */
export function getPermissions(user: AuthUser | null): Permission[] {
    const role = getAdminRole(user);
    if (role === 'admin') return ALL_PERMISSIONS;
    if (role !== 'staff') return [];
    const stored = user?.app_metadata?.permissions;
    return Array.isArray(stored) ? stored.filter(isPermission) : DEFAULT_STAFF_PERMISSIONS;
}

/** Full admins only. */
export function isAdminUser(user: AuthUser | null): boolean {
    return getAdminRole(user) === 'admin';
}

/** Headers middleware.ts sets on authorized back-office API requests (client values are overwritten). */
export const ADMIN_HEADERS = {
    role: 'x-admin-role',
    userId: 'x-admin-user-id',
    email: 'x-admin-email',
    permissions: 'x-admin-permissions',
} as const;

export interface AdminActor {
    role: AdminRole | null;
    userId: string | null;
    email: string | null;
    permissions: Permission[];
}

/** Who is calling a back-office API route, as verified by middleware. */
export function getAdminActor(headers: Headers): AdminActor {
    const role = headers.get(ADMIN_HEADERS.role);
    return {
        role: role === 'admin' || role === 'staff' ? role : null,
        userId: headers.get(ADMIN_HEADERS.userId) || null,
        email: headers.get(ADMIN_HEADERS.email) || null,
        permissions: (headers.get(ADMIN_HEADERS.permissions) ?? '').split(',').filter(isPermission),
    };
}
