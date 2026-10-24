import supabase from '@/lib/supabase-admin';
import { must } from '@/lib/erp/api';

export interface TeamMember {
    user_id: string;
    email: string | null;
    role: 'owner' | 'admin' | 'staff';
    permissions: string[];
}

/** Live back-office users (kept in sync by GET /api/admin/me and the Team API). */
export async function listTeam(): Promise<TeamMember[]> {
    return must(await supabase.from('back_office_users').select('user_id, email, role, permissions').is('deleted_at', null).order('email')) as TeamMember[];
}

/** The e-mail of a back-office user, or null when they are not (or no longer) on the team. */
export async function memberEmail(userId: string): Promise<string | null> {
    const { data } = await supabase.from('back_office_users').select('email').eq('user_id', userId).is('deleted_at', null).maybeSingle();
    return data?.email ?? null;
}
