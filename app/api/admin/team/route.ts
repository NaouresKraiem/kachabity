import { NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/activity-log';
import supabase from '@/lib/supabase-admin';
import { ALL_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS, getAdminActor, getAdminRole, getPermissions, isRoleFromSettings, type AdminRole, type Permission } from '@/lib/admin-auth';
import { syncBackOfficeUser } from '@/lib/back-office-users';

export const dynamic = 'force-dynamic';

// Back-office team (owners, admins and staff). Middleware limits every method to owners and
// admins; only owners can make someone an owner or change or delete an owner.

// Supabase Auth admin calls fail with a status-0 "retryable" error when the connection drops;
// retry those a couple of times instead of surfacing a spurious failure.
async function withRetry<T>(call: () => PromiseLike<T>): Promise<T> {
    const retryable = (r: T) => {
        const error = (r as { error?: { status?: number; name?: string } | null }).error;
        return !!error && (error.status === 0 || error.name === 'AuthRetryableFetchError');
    };
    let result = await call();
    for (let attempt = 1; attempt < 3 && retryable(result); attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        result = await call();
    }
    return result;
}

const notFoundOr = (error: { status?: number; message?: string } | null) =>
    !error || error.status === 404
        ? NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
        : NextResponse.json({ success: false, error: `Could not reach Supabase Auth: ${error.message}` }, { status: 502 });

type AuthUser = { id: string; email?: string; app_metadata?: Record<string, unknown>; last_sign_in_at?: string | null; created_at: string };

const member = (user: AuthUser) => ({
    id: user.id,
    email: user.email ?? '',
    role: getAdminRole(user),
    permissions: getPermissions(user),
    // OWNER_EMAILS owners and ADMIN_EMAILS admins can't be changed from here.
    locked: isRoleFromSettings(user),
    last_sign_in_at: user.last_sign_in_at ?? null,
    created_at: user.created_at,
});

export async function GET() {
    const users: AuthUser[] = [];
    for (let page = 1; ; page += 1) {
        const { data, error } = await withRetry<Awaited<ReturnType<typeof supabase.auth.admin.listUsers>>>(() => supabase.auth.admin.listUsers({ page, perPage: 1000 }));
        if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        users.push(...(data.users as AuthUser[]));
        if (data.users.length < 1000) break;
    }
    const team = users.filter((u) => getAdminRole(u)).map(member);
    return NextResponse.json({ success: true, data: team });
}

const isRole = (value: unknown): value is AdminRole => value === 'owner' || value === 'admin' || value === 'staff';

const ownersOnly = () =>
    NextResponse.json({ success: false, error: 'Only an owner can give the owner role or change an owner.' }, { status: 403 });

// The account's own fields, for back_office_users.
const syncMember = (user: AuthUser) => syncBackOfficeUser({
    id: user.id, email: user.email ?? null, role: getAdminRole(user), permissions: getPermissions(user),
});

// Keeps only known permission names; undefined means "not provided".
function parsePermissions(value: unknown): Permission[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return [];
    return ALL_PERMISSIONS.filter((p) => value.includes(p));
}

// POST { email, password, role, permissions? } creates a back-office account.
export async function POST(request: NextRequest) {
    const { email, password, role, permissions } = await request.json();
    if (typeof email !== 'string' || !email.includes('@') || !isRole(role)) {
        return NextResponse.json({ success: false, error: 'A valid email and role are required' }, { status: 400 });
    }
    if (role === 'owner' && getAdminActor(request.headers).role !== 'owner') return ownersOnly();

    const { data, error } = await withRetry<Awaited<ReturnType<typeof supabase.auth.admin.createUser>>>(() => supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: typeof password === 'string' && password ? password : undefined,
        email_confirm: true,
        // Owners and admins have every permission, so only staff store a list.
        app_metadata: role === 'staff' ? { role, permissions: parsePermissions(permissions) ?? DEFAULT_STAFF_PERMISSIONS } : { role },
    }));
    if (error) {
        const exists = /already|registered|exists/i.test(error.message);
        return NextResponse.json(
            { success: false, error: exists ? 'An account with this email already exists. Change its role from the list instead.' : error.message },
            { status: exists ? 409 : 400 }
        );
    }
    const created = member(data.user as AuthUser);
    await syncMember(data.user as AuthUser);
    await logActivity(getAdminActor(request.headers), {
        action: 'create', entity: 'team_member', entityId: created.id, label: created.email,
        changes: { role: created.role, permissions: created.permissions },
    });
    return NextResponse.json({ success: true, data: created });
}

// PUT { id, role, permissions? } changes a member's role and staff permissions;
// role null removes back-office access (the account stays).
export async function PUT(request: NextRequest) {
    const { id, role, permissions } = await request.json();
    if (!id || (!isRole(role) && role !== null)) {
        return NextResponse.json({ success: false, error: 'id and role are required' }, { status: 400 });
    }
    if (id === getAdminActor(request.headers).userId) {
        return NextResponse.json({ success: false, error: 'You cannot change your own role.' }, { status: 400 });
    }

    const { data: existing, error: getError } = await withRetry<Awaited<ReturnType<typeof supabase.auth.admin.getUserById>>>(() => supabase.auth.admin.getUserById(id));
    if (getError || !existing.user) return notFoundOr(getError);
    if ((role === 'owner' || getAdminRole(existing.user) === 'owner') && getAdminActor(request.headers).role !== 'owner') return ownersOnly();
    if (isRoleFromSettings(existing.user)) {
        return NextResponse.json({ success: false, error: 'This role comes from the OWNER_EMAILS or ADMIN_EMAILS setting. Change it there.' }, { status: 400 });
    }

    const appMetadata: Record<string, unknown> = { ...(existing.user.app_metadata ?? {}), role };
    const parsed = parsePermissions(permissions);
    if (role === 'staff') {
        // Keep a staff member's list; someone becoming staff starts from the default set.
        appMetadata.permissions = parsed ?? (getAdminRole(existing.user) === 'staff' ? getPermissions(existing.user) : DEFAULT_STAFF_PERMISSIONS);
    } else {
        delete appMetadata.permissions;
    }
    const { data, error } = await withRetry<Awaited<ReturnType<typeof supabase.auth.admin.updateUserById>>>(() => supabase.auth.admin.updateUserById(id, { app_metadata: appMetadata }));
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    await syncMember(data.user as AuthUser);
    await logActivity(getAdminActor(request.headers), {
        action: role === null ? 'remove_access' : 'update', entity: 'team_member', entityId: id, label: existing.user.email ?? null,
        changes: {
            role: { from: getAdminRole(existing.user), to: role },
            permissions: { from: getAdminRole(existing.user) ? getPermissions(existing.user) : [], to: appMetadata.permissions ?? null },
        },
    });
    return NextResponse.json({ success: true, data: member(data.user as AuthUser) });
}

// DELETE ?id= soft-deletes a back-office account: it can no longer sign in, and its row,
// stock movements and orders stay as they are.
export async function DELETE(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    if (id === getAdminActor(request.headers).userId) {
        return NextResponse.json({ success: false, error: 'You cannot delete your own account.' }, { status: 400 });
    }

    const { data: existing, error: getError } = await withRetry<Awaited<ReturnType<typeof supabase.auth.admin.getUserById>>>(() => supabase.auth.admin.getUserById(id));
    if (getError || !existing.user) return notFoundOr(getError);
    if (getAdminRole(existing.user) === 'owner' && getAdminActor(request.headers).role !== 'owner') return ownersOnly();
    if (isRoleFromSettings(existing.user)) {
        return NextResponse.json({ success: false, error: 'This role comes from the OWNER_EMAILS or ADMIN_EMAILS setting. Remove it there first.' }, { status: 400 });
    }

    // Soft delete: access is removed first (so the account leaves the team list), then
    // Supabase Auth marks the user deleted instead of removing the row.
    const appMetadata: Record<string, unknown> = { ...(existing.user.app_metadata ?? {}), role: null, deleted_at: new Date().toISOString() };
    delete appMetadata.permissions;
    const { error: updateError } = await withRetry<Awaited<ReturnType<typeof supabase.auth.admin.updateUserById>>>(() => supabase.auth.admin.updateUserById(id, { app_metadata: appMetadata }));
    if (updateError) return NextResponse.json({ success: false, error: updateError.message }, { status: 400 });
    const { error } = await withRetry<Awaited<ReturnType<typeof supabase.auth.admin.deleteUser>>>(() => supabase.auth.admin.deleteUser(id, true));
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    await syncBackOfficeUser({ id, email: existing.user.email ?? null, role: null, permissions: [] });
    await logActivity(getAdminActor(request.headers), {
        action: 'delete', entity: 'team_member', entityId: id, label: existing.user.email ?? null,
        changes: { role: { from: getAdminRole(existing.user), to: null } },
    });
    return NextResponse.json({ success: true });
}
