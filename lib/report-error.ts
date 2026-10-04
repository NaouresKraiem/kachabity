import * as Sentry from "@sentry/nextjs";

/** Sends a handled error to Sentry, tagged with the area of the app it came from.
 * Use it where an error is caught and turned into a response or a fallback, so it
 * would otherwise only reach the server logs. Never put customer details in `extra`. */
export function reportError(error: unknown, area: string, extra?: Record<string, string | number>) {
    Sentry.captureException(error, { tags: { area }, extra });
}
