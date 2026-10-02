import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor } from '@/lib/admin-auth';

// Role of the signed-in back-office user (verified by middleware), so the admin UI
// can hide admin-only controls. Permissions are still enforced by middleware.
export async function GET(request: NextRequest) {
    const actor = getAdminActor(request.headers);
    return NextResponse.json({ success: true, data: { role: actor.role, email: actor.email, permissions: actor.permissions } });
}
