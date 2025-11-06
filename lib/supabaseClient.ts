

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fhimhbrhlzhxojtiumhm.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
    throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Please add it to your .env.local file.\n" +
        "Get your key from: https://fhimhbrhlzhxojtiumhm.supabase.co/project/_/settings/api"
    );
}

const supabase = createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
        // storage: sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
    },
});

// Export the singleton instance as default
export default supabase;

// Export a function to create new clients (for server-side use)
export function createClient() {
    return createSupabaseClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
    });
}
