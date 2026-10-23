import { z } from 'zod';

// Validated once at boot: a missing or malformed variable stops the server with its name.
const schema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_JWKS: z.string().optional(),
  OWNER_EMAILS: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  NEXT_URL: z.string().url().optional(),
  REVALIDATE_SECRET: z.string().min(16).optional(),
  // External systems may read GET /api/stock/inventory with this key in x-api-key.
  STOCK_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  ENV: z.enum(['local', 'production']).default('local'),
  PORT: z.coerce.number().int().default(4000),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n  ');
    console.error(`Invalid environment:\n  ${problems}`);
    process.exit(1);
  }
  return parsed.data;
}

export const config = loadConfig();
