

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fhimhbrhlzhxojtiumhm.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Never throw at module load time - this allows builds to complete
// Validation will happen at runtime when the client is actually used
// Create client with available key or placeholder (will fail at runtime if key is missing)
const supabase = createSupabaseClient(
    supabaseUrl,
    supabaseKey || 'placeholder-key-for-build',
    {
        auth: {
            // storage: sessionStorage,
            persistSession: true,
            autoRefreshToken: true,
        },
    }
);

// Export the singleton instance as default
export default supabase;

// Export a function to create new clients (for server-side use)
export function createClient() {
    if (!supabaseKey) {
        throw new Error(
            "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Please add it to your .env.local file.\n" +
            "Get your key from: https://fhimhbrhlzhxojtiumhm.supabase.co/project/_/settings/api"
        );
    }
    return createSupabaseClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
    });
}
