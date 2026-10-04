// Deployment environment, from the ENV variable: "local" on developer machines,
// "production" on the live site (set in Netlify). next.config.ts passes it through
// as NEXT_PUBLIC_APP_ENV at build time, so browser, server and edge code all see it.

export type AppEnv = "local" | "production" | (string & {});

export const APP_ENV: AppEnv = process.env.NEXT_PUBLIC_APP_ENV || "local";

export const isProduction = APP_ENV === "production";
export const isLocal = APP_ENV === "local";
