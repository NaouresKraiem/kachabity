

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fhimhbrhlzhxojtiumhm.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if we're in a build environment (Next.js sets NODE_ENV during build)
// During build, we allow missing keys to prevent build failures
// The app will fail at runtime if keys are missing, which is the correct behavior
const isBuildTime = process.env.NODE_ENV === 'production' && !supabaseKey && !process.env.VERCEL && !process.env.NETLIFY;

if (!supabaseKey && !isBuildTime) {
    throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Please add it to your .env.local file.\n" +
        "Get your key from: https://fhimhbrhlzhxojtiumhm.supabase.co/project/_/settings/api"
    );
}

// Create client - use a placeholder key during build if needed
// This allows the build to complete, but API calls will fail at runtime if the real key is missing
const supabase = createSupabaseClient(
    supabaseUrl,
    supabaseKey || 'build-time-placeholder',
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
