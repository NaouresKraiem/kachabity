import supabase from '@/lib/supabase-admin';
import type { AdminActor } from '@/lib/admin-auth';

/**
 * Back-office history (Admin → Activity). Database triggers (private.log_activity) record
 * every change to business tables with the staff member behind the request. Use this only
 * for changes the database can't see, such as team accounts in Supabase Auth.
 */
export async function logActivity(
    actor: AdminActor,
    entry: { action: string; entity: string; entityId?: string | null; label?: string | null; changes?: Record<string, unknown> | null }
): Promise<void> {
    const { error } = await supabase.from('activity_log').insert({
        actor_id: actor.userId,
        actor_email: actor.email,
        actor_role: actor.role,
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entityId ?? null,
        label: entry.label ?? null,
        changes: entry.changes ?? null,
    });
    // The change itself succeeded; a failed log line must not turn it into an error.
    if (error) console.error('Error writing activity log:', error);
}
