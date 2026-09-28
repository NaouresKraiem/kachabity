type AuthUser = { email?: string | null; app_metadata?: Record<string, unknown> };

/**
 * Keep admin authorization consistent across UI and API boundaries.
 * Only app_metadata is trusted: user_metadata is editable by the user themselves.
 */
export function isAdminUser(user: AuthUser | null): boolean {
    if (!user) return false;

    if (user.app_metadata?.role === 'admin') return true;

    const allowedEmails = (process.env.ADMIN_EMAILS ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

    return Boolean(user.email && allowedEmails.includes(user.email.toLowerCase()));
}
