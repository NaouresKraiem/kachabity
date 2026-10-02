import { createClient } from '@supabase/supabase-js';
import defaultSupabase from '@/lib/supabaseClient';
import { supabaseUrl } from '@/lib/supabase-env';
import { resilientFetch } from '@/lib/resilient-fetch';
import { ADMIN_HEADERS } from '@/lib/admin-auth';

// Service-role client for API routes. It bypasses RLS, so only use it in route
// handlers that middleware.ts gates as admin-only, or that validate their own input.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set. Admin writes will be rejected by RLS.');
}

// The staff member behind the current request (headers set by middleware.ts after it
// verified the session), or null outside a back-office request (checkout, scripts, cache).
async function currentActor(): Promise<{ id: string; email: string; role: string } | null> {
    try {
        const { headers } = await import('next/headers');
        const h = await headers();
        const id = h.get(ADMIN_HEADERS.userId);
        return id ? { id, email: h.get(ADMIN_HEADERS.email) ?? '', role: h.get(ADMIN_HEADERS.role) ?? '' } : null;
    } catch {
        return null;
    }
}

// Every service-role request made for a staff member carries their identity, so the
// database activity log (private.log_activity) records who made each change.
const actorFetch: typeof fetch = async (input, init) => {
    const actor = await currentActor();
    if (!actor) return resilientFetch(input, init);
    const headers = new Headers(init?.headers);
    headers.set('x-actor-id', actor.id);
    headers.set('x-actor-email', actor.email);
    headers.set('x-actor-role', actor.role);
    return resilientFetch(input, { ...init, headers });
};

const supabaseAdmin = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { fetch: actorFetch },
      })
    : defaultSupabase;

export default supabaseAdmin;
