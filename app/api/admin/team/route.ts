import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase-admin';
import { ALL_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS, getAdminActor, getAdminRole, getPermissions, type Permission } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// Back-office team (admins and staff). Middleware limits every method to admins.

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
    // ADMIN_EMAILS admins can't be changed from here.
    locked: getAdminRole(user) === 'admin' && user.app_metadata?.role !== 'admin',
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

// Keeps only known permission names; undefined means "not provided".
function parsePermissions(value: unknown): Permission[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return [];
    return ALL_PERMISSIONS.filter((p) => value.includes(p));
}

// POST { email, password, role, permissions? } creates a back-office account.
export async function POST(request: NextRequest) {
    const { email, password, role, permissions } = await request.json();
    if (typeof email !== 'string' || !email.includes('@') || (role !== 'admin' && role !== 'staff')) {
        return NextResponse.json({ success: false, error: 'A valid email and role are required' }, { status: 400 });
    }

    const { data, error } = await withRetry<Awaited<ReturnType<typeof supabase.auth.admin.createUser>>>(() => supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: typeof password === 'string' && password ? password : undefined,
        email_confirm: true,
        // Admins have every permission, so only staff store a list.
        app_metadata: role === 'staff' ? { role, permissions: parsePermissions(permissions) ?? DEFAULT_STAFF_PERMISSIONS } : { role },
    }));
    if (error) {
        const exists = /already|registered|exists/i.test(error.message);
        return NextResponse.json(
            { success: false, error: exists ? 'An account with this email already exists. Change its role from the list instead.' : error.message },
            { status: exists ? 409 : 400 }
        );
    }
    return NextResponse.json({ success: true, data: member(data.user as AuthUser) });
}

// PUT { id, role, permissions? } changes a member's role and staff permissions;
// role null removes back-office access (the account stays).
export async function PUT(request: NextRequest) {
    const { id, role, permissions } = await request.json();
    if (!id || (role !== 'admin' && role !== 'staff' && role !== null)) {
        return NextResponse.json({ success: false, error: 'id and role are required' }, { status: 400 });
    }
    if (id === getAdminActor(request.headers).userId) {
        return NextResponse.json({ success: false, error: 'You cannot change your own role.' }, { status: 400 });
    }

    const { data: existing, error: getError } = await withRetry<Awaited<ReturnType<typeof supabase.auth.admin.getUserById>>>(() => supabase.auth.admin.getUserById(id));
    if (getError || !existing.user) return notFoundOr(getError);

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
    return NextResponse.json({ success: true, data: member(data.user as AuthUser) });
}

// DELETE ?id= permanently deletes a back-office account. Their stock movements keep the
// author's email; orders placed with the account are kept without the link.
export async function DELETE(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    if (id === getAdminActor(request.headers).userId) {
        return NextResponse.json({ success: false, error: 'You cannot delete your own account.' }, { status: 400 });
    }

    const { data: existing, error: getError } = await withRetry<Awaited<ReturnType<typeof supabase.auth.admin.getUserById>>>(() => supabase.auth.admin.getUserById(id));
    if (getError || !existing.user) return notFoundOr(getError);
    if (getAdminRole(existing.user) === 'admin' && existing.user.app_metadata?.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'This admin comes from the ADMIN_EMAILS setting. Remove it there first.' }, { status: 400 });
    }

    const { error } = await withRetry<Awaited<ReturnType<typeof supabase.auth.admin.deleteUser>>>(() => supabase.auth.admin.deleteUser(id));
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
}
