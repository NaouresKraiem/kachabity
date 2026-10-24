// Applies the migrations a plain-Postgres database doesn't have yet (replaces `supabase db push`).
// Each file runs in its own transaction and is recorded in supabase_migrations.schema_migrations,
// the history the database brought from Supabase (scripts/db/move-database.mjs).
// Usage: DATABASE_URL=… node scripts/migrate.mjs [migrations folder] [--dry-run]
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pg from 'pg';

const folder = resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? '../supabase/migrations');
const dryRun = process.argv.includes('--dry-run');
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query('select version from supabase_migrations.schema_migrations');
  const applied = new Set(rows.map((r) => r.version));
  const pending = readdirSync(folder)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort()
    .filter((f) => !applied.has(f.split('_')[0]));
  if (pending.length === 0) console.log('Up to date.');
  for (const file of pending) {
    const [version, ...rest] = file.replace(/\.sql$/, '').split('_');
    console.log(`${dryRun ? 'Would apply' : 'Applying'} ${file}`);
    if (dryRun) continue;
    await client.query('begin');
    try {
      await client.query(readFileSync(join(folder, file), 'utf8'));
      await client.query('insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)', [version, rest.join('_')]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw new Error(`${file}: ${error.message}`);
    }
  }
} finally {
  await client.end();
}
