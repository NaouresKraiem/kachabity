import supabase from '@/lib/supabase-admin';
import type { AdminRole, Permission } from '@/lib/admin-auth';

/**
 * Keeps public.back_office_users in step with each person's role, so the database knows
 * who receives order notifications and owner alerts (roles from OWNER_EMAILS and
 * ADMIN_EMAILS included). Refreshed by GET /api/admin/me on every admin visit and by the
 * Team API. A null role marks the row deleted.
 */
export async function syncBackOfficeUser(user: { id: string | null; email: string | null; role: AdminRole | null; permissions: Permission[] }): Promise<void> {
    if (!user.id) return;
    const { error } = user.role
        ? await supabase.from('back_office_users').upsert({
              user_id: user.id,
              email: user.email,
              role: user.role,
              permissions: user.permissions,
              deleted_at: null,
          }, { onConflict: 'user_id' })
        : await supabase.from('back_office_users').update({ deleted_at: new Date().toISOString() }).eq('user_id', user.id).is('deleted_at', null);
    // Notifications only; never fail the request because of it.
    if (error) console.error('Error syncing back-office user:', error);
}
