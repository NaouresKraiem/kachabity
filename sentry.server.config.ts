// Sentry on the server (Node.js runtime): server components, route handlers, API routes.
import * as Sentry from "@sentry/nextjs";
import { backendSentryOptions } from "@/lib/sentry-options";

Sentry.init(backendSentryOptions);
