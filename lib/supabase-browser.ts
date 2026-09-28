"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabasePublishableKey } from "@/lib/supabase-env";

// Cookie-backed client for the admin area: middleware.ts reads the session from
// these cookies to authorize /admin pages and admin API routes.
export function createAdminBrowserClient() {
    return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
