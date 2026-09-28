

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl as configuredUrl, supabasePublishableKey } from "@/lib/supabase-env";

const supabaseUrl = configuredUrl || "https://placeholder.supabase.co";
const supabaseKey = supabasePublishableKey;

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
            "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Add it to your .env file\n" +
            "(Supabase dashboard → Project Settings → API Keys)."
        );
    }
    return createSupabaseClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
    });
}
