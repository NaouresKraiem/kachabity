import type { ErrorEvent } from "@sentry/nextjs";
import { APP_ENV } from "@/lib/app-env";

// Shared Sentry settings for the browser, server and edge runtimes, chosen by the
// ENV variable (lib/app-env.ts). Events are tagged with it as the Sentry environment.
//
//   ENV          reports from                 performance traces
//   production   the live site                10% of requests (free quota)
//   local        production builds only       all requests, for testing
//                (next build + next start);
//                `next dev` never reports
//   other        e.g. a staging deploy         20% of requests
//
// Nothing is sent without NEXT_PUBLIC_SENTRY_DSN.

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

const envSettings: Record<string, { tracesSampleRate: number }> = {
    production: { tracesSampleRate: 0.1 },
    local: { tracesSampleRate: 1.0 },
};

/** Removes customer data before an event leaves the app. Checkout requests carry
 * names, phones and addresses, so request bodies, cookies and auth headers never
 * reach Sentry. */
function scrubEvent(event: ErrorEvent): ErrorEvent {
    if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
            for (const name of Object.keys(event.request.headers)) {
                if (/^(authorization|cookie|x-admin-)/i.test(name)) delete event.request.headers[name];
            }
        }
    }
    if (event.user) event.user = { id: event.user.id };
    return event;
}

export const sentryOptions = {
    dsn,
    // The dev server's hot reloads and half-finished code would only add noise.
    enabled: Boolean(dsn) && process.env.NODE_ENV === "production",
    environment: APP_ENV,
    tracesSampleRate: (envSettings[APP_ENV] ?? { tracesSampleRate: 0.2 }).tracesSampleRate,
    // No IP addresses, cookies or request bodies.
    sendDefaultPii: false,
    beforeSend: scrubEvent,
};
