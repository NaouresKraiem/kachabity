import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor } from '@/lib/admin-auth';
import { syncBackOfficeUser } from '@/lib/back-office-users';

// Role of the signed-in back-office user (verified by middleware), so the admin UI
// can hide admin-only controls. Permissions are still enforced by middleware.
// Also refreshes their row in back_office_users (who receives which notifications).
export async function GET(request: NextRequest) {
    const actor = getAdminActor(request.headers);
    await syncBackOfficeUser({ id: actor.userId, email: actor.email, role: actor.role, permissions: actor.permissions });
    return NextResponse.json({ success: true, data: { id: actor.userId, role: actor.role, email: actor.email, permissions: actor.permissions } });
}
