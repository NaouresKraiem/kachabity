import { createClient } from '@supabase/supabase-js';
import defaultSupabase from '@/lib/supabaseClient';
import { supabaseUrl } from '@/lib/supabase-env';
import { resilientFetch } from '@/lib/resilient-fetch';

// Service-role client for API routes. It bypasses RLS, so only use it in route
// handlers that middleware.ts gates as admin-only, or that validate their own input.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set. Admin writes will be rejected by RLS.');
}

const supabaseAdmin = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { fetch: resilientFetch },
      })
    : defaultSupabase;

export default supabaseAdmin;
