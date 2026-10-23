// Copies the live data (products, orders, customers, settings, accounts…) into the LOCAL Supabase
// for the Docker setup (docs/DOCKER.md). Reads the live database only; writes only the local one.
//
// 1. Resets the local database to the migration the live database is at.
// 2. Loads the live rows of every public table plus auth.users / auth.identities (same logins),
//    with triggers off so nothing is logged, notified or recomputed twice.
// 3. Applies the newer local migrations on top, as a production rollout would (ERP backfills run).
//
// Usage: node scripts/docker/import-live-data.mjs   (SOURCE_DATABASE_URL in .env.docker or the environment)
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const LOCAL_DB_CONTAINER = 'supabase_db_kachabity';
const SUPABASE = ['-y', 'supabase@2.121.0'];
const DUMP = '.docker-data/live-data.sql'; // git-ignored: holds customer data

const fromEnvFile = existsSync('.env.docker')
    ? readFileSync('.env.docker', 'utf8').match(/^SOURCE_DATABASE_URL=(.*)$/m)?.[1]?.trim()
    : undefined;
const source = process.env.SOURCE_DATABASE_URL || fromEnvFile;
if (!source) {
    console.error('Set SOURCE_DATABASE_URL (live database, session pooler URL) in .env.docker.');
    process.exit(1);
}
if (!/^postgres(ql)?:\/\/[^@\s]+@[^\s]+$/.test(source)) {
    console.error('SOURCE_DATABASE_URL must be the Postgres connection string, without quotes, e.g.\n' +
        '  postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres\n' +
        '(Supabase dashboard → Connect → Session pooler), not the https:// project URL.');
    process.exit(1);
}

const run = (cmd, args, options = {}) => {
    const result = spawnSync(cmd, args, { stdio: ['pipe', 'pipe', 'inherit'], encoding: 'utf8', maxBuffer: 1 << 30, shell: process.platform === 'win32' && cmd === 'npx', ...options });
    if (result.status !== 0) throw new Error(`${cmd} ${args[0]} failed (exit ${result.status})`);
    return result.stdout;
};
// Postgres 17 client tools in a throwaway container, so nothing needs installing.
const pg = (tool, args) => run('docker', ['run', '--rm', '-i', 'postgres:17', tool, source, ...args]);

console.log('Reading the live migration version…');
const liveVersion = pg('psql', ['-tAc', 'select max(version) from supabase_migrations.schema_migrations']).trim();
const local = readdirSync('supabase/migrations').map((f) => f.split('_')[0]).sort();
if (!local.includes(liveVersion)) throw new Error(`Live is at ${liveVersion}, which is not in supabase/migrations.`);
console.log(`Live database is at ${liveVersion}; ${local.filter((v) => v > liveVersion).length} newer local migration(s) will run after the import.`);

console.log('Dumping live data (read only)…');
mkdirSync('.docker-data', { recursive: true });
const dump = pg('pg_dump', ['--data-only', '--no-owner', '--no-privileges', '-t', 'public.*', '-t', 'auth.users', '-t', 'auth.identities'])
    // \restrict lines come from newer pg_dump versions; the local psql may not know them.
    .split('\n').filter((line) => !/^\\(un)?restrict /.test(line)).join('\n');
writeFileSync(DUMP, dump);

const tables = [...dump.matchAll(/^COPY ([^ ]+) \(/gm)].map((m) => m[1]);
console.log(`Resetting the local database to ${liveVersion}…`);
run('npx', [...SUPABASE, 'db', 'reset', '--local', '--version', liveVersion], { stdio: 'inherit' });

console.log(`Loading ${tables.length} tables…`);
const restore = `set client_min_messages = warning;\nset session_replication_role = replica;\ntruncate ${tables.join(', ')} cascade;\n${dump}\n`;
run('docker', ['exec', '-i', LOCAL_DB_CONTAINER, 'psql', '-q', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-1'], { input: restore });

console.log('Applying newer migrations…');
run('npx', [...SUPABASE, 'migration', 'up', '--local'], { stdio: 'inherit' });

const counts = execFileSync('docker', ['exec', LOCAL_DB_CONTAINER, 'psql', '-tA', '-U', 'postgres', '-c',
    `select 'products', count(*) from products union all select 'orders', count(*) from orders
     union all select 'customers', count(*) from customers union all select 'users', count(*) from auth.users`], { encoding: 'utf8' });
console.log(`Done.\n${counts}\nRestart the site so it drops its cached pages: docker compose restart web`);
