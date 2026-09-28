// Supabase connection settings shared by browser, server, and middleware clients.
// New projects issue publishable keys (sb_publishable_...); the legacy anon key
// name is still accepted so older environments keep working.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
