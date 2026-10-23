// Copies the live data (products, orders, customers, settings, accounts…) into the LOCAL Supabase
// for the Docker setup (docs/DOCKER.md). Reads the live project only; writes only the local one.
//
// 1. Resets the local database to the migration the live database is at.
// 2. Loads the live rows of every public table plus the sign-in accounts, with triggers off so
//    nothing is logged, notified or recomputed twice.
// 3. Applies the newer local migrations on top, as a production rollout would (ERP backfills run).
//
// Two ways to read the live project:
// - SOURCE_DATABASE_URL (Postgres connection string, needs the database password): pg_dump.
//   Accounts keep their live passwords.
// - Otherwise the REST API with the service-role key (SOURCE_SUPABASE_URL + SOURCE_SERVICE_ROLE_KEY,
//   defaulting to NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local). Only GET
//   requests are sent. The API doesn't return password hashes, so every account gets
//   LOCAL_PASSWORD (default below) on the local copy.
//
// Usage: node scripts/docker/import-live-data.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const LOCAL_DB_CONTAINER = 'supabase_db_kachabity';
const SUPABASE = ['-y', 'supabase@2.121.0'];
const DUMP = '.docker-data/live-data.sql'; // git-ignored: holds customer data
const PAGE = 1000;

const envFile = (file, name) =>
    existsSync(file) ? readFileSync(file, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim() || undefined : undefined;
const setting = (name, fallbackFile, fallbackName) =>
    process.env[name] || envFile('.env.docker', name) || (fallbackFile ? envFile(fallbackFile, fallbackName) : undefined);

const run = (cmd, args, options = {}) => {
    const result = spawnSync(cmd, args, { stdio: ['pipe', 'pipe', 'inherit'], encoding: 'utf8', maxBuffer: 1 << 30, shell: process.platform === 'win32' && cmd === 'npx', ...options });
    if (result.status !== 0) throw new Error(`${cmd} ${args[0]} failed (exit ${result.status})`);
    return result.stdout;
};
const localSql = (sql, user = 'postgres') => run('docker', ['exec', '-i', LOCAL_DB_CONTAINER, 'psql', '-tA', '-U', user, '-d', 'postgres'], { input: sql });
const restoreLocal = (sql) =>
    run('docker', ['exec', '-i', LOCAL_DB_CONTAINER, 'psql', '-q', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-1'], {
        input: `set client_min_messages = warning;\nset session_replication_role = replica;\n${sql}\n`,
    });
const resetLocalTo = (version) => run('npx', [...SUPABASE, 'db', 'reset', '--local', '--version', version], { stdio: 'inherit' });
const ident = (name) => `"${name.replace(/"/g, '""')}"`;
// Dollar-quoted literal with a random tag, so the data never needs escaping.
const literal = (text) => {
    const tag = `$d${randomBytes(6).toString('hex')}$`;
    return `${tag}${text}${tag}`;
};
const migrations = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();
const versions = migrations.map((f) => f.split('_')[0]);
mkdirSync('.docker-data', { recursive: true });

const databaseUrl = setting('SOURCE_DATABASE_URL');
if (databaseUrl) await fromDatabase(databaseUrl);
else await fromRestApi();

console.log('Applying newer migrations…');
run('npx', [...SUPABASE, 'migration', 'up', '--local'], { stdio: 'inherit' });

const counts = localSql(`select 'products', count(*) from products union all select 'orders', count(*) from orders
     union all select 'customers', count(*) from customers union all select 'users', count(*) from auth.users`);
console.log(`Done.\n${counts}\nRestart the site so it drops its cached pages: docker compose restart web`);

async function fromDatabase(source) {
    if (!/^postgres(ql)?:\/\/[^@\s]+@[^\s]+$/.test(source)) {
        console.error('SOURCE_DATABASE_URL must be the Postgres connection string, without quotes, e.g.\n' +
            '  postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres\n' +
            '(Supabase dashboard → Connect → Session pooler), not the https:// project URL. Without the\n' +
            'database password, leave it empty: the REST API is used instead.');
        process.exit(1);
    }
    // Postgres 17 client tools in a throwaway container, so nothing needs installing.
    const pg = (tool, args) => run('docker', ['run', '--rm', '-i', 'postgres:17', tool, source, ...args]);

    console.log('Reading the live migration version…');
    const liveVersion = pg('psql', ['-tAc', 'select max(version) from supabase_migrations.schema_migrations']).trim();
    if (!versions.includes(liveVersion)) throw new Error(`Live is at ${liveVersion}, which is not in supabase/migrations.`);
    console.log(`Live database is at ${liveVersion}.`);

    console.log('Dumping live data (read only)…');
    const dump = pg('pg_dump', ['--data-only', '--no-owner', '--no-privileges', '-t', 'public.*', '-t', 'auth.users', '-t', 'auth.identities'])
        // \restrict lines come from newer pg_dump versions; the local psql may not know them.
        .split('\n').filter((line) => !/^\\(un)?restrict /.test(line)).join('\n');
    writeFileSync(DUMP, dump);

    const tables = [...dump.matchAll(/^COPY ([^ ]+) \(/gm)].map((m) => m[1]);
    console.log(`Resetting the local database to ${liveVersion}…`);
    resetLocalTo(liveVersion);
    console.log(`Loading ${tables.length} tables…`);
    restoreLocal(`truncate ${tables.join(', ')} cascade;\n${dump}`);
}

async function fromRestApi() {
    const url = setting('SOURCE_SUPABASE_URL', '.env.local', 'NEXT_PUBLIC_SUPABASE_URL')?.replace(/\/$/, '');
    const key = setting('SOURCE_SERVICE_ROLE_KEY', '.env.local', 'SUPABASE_SERVICE_ROLE_KEY');
    const password = setting('LOCAL_PASSWORD') || 'Kachabity-local-1';
    if (!url || !key) {
        console.error('Set SOURCE_DATABASE_URL, or SOURCE_SUPABASE_URL + SOURCE_SERVICE_ROLE_KEY, in .env.docker.');
        process.exit(1);
    }
    if (/localhost|127\.0\.0\.1|host\.docker\.internal/.test(url)) throw new Error(`${url} is the local Supabase, not the live one.`);

    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const get = async (path) => {
        const response = await fetch(`${url}${path}`, { headers }); // GET only: the live project is never written
        if (!response.ok) throw new Error(`GET ${path.split('?')[0]}: ${response.status} ${(await response.text()).slice(0, 300)}`);
        return response.json();
    };

    console.log(`Reading ${url} (read only)…`);
    const liveTables = new Set(Object.keys((await get('/rest/v1/')).definitions ?? {}));

    // The live version is the last migration whose tables all exist live (the API doesn't expose
    // the migration history). SOURCE_MIGRATION_VERSION overrides the guess.
    let liveVersion = setting('SOURCE_MIGRATION_VERSION');
    if (!liveVersion) {
        for (const file of migrations) {
            const sql = readFileSync(`supabase/migrations/${file}`, 'utf8');
            const created = [...sql.matchAll(/create table (?:if not exists )?(?:public\.)?"?(\w+)"?(?![\w.])/gi)].map((m) => m[1]);
            if (created.some((table) => !liveTables.has(table))) break;
            liveVersion = file.split('_')[0];
        }
    }
    if (!versions.includes(liveVersion)) throw new Error(`Migration ${liveVersion} is not in supabase/migrations.`);
    console.log(`Live database looks like migration ${liveVersion}; resetting the local database to it…`);
    resetLocalTo(liveVersion);

    const shape = JSON.parse(localSql(`select json_object_agg(t.relname, json_build_object(
        'columns', (select json_agg(a.attname order by a.attnum) from pg_attribute a
                     where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''),
        'pk', (select json_agg(a.attname) from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
                where i.indrelid = t.oid and i.indisprimary)))
      from pg_class t join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public' and t.relkind = 'r'`));
    const tables = Object.keys(shape).filter((table) => liveTables.has(table)).sort();

    const statements = [];
    let total = 0;
    for (const table of tables) {
        const { columns, pk } = shape[table];
        const order = (pk?.length ? pk : [columns[0]]).map((c) => `${c}.asc`).join(',');
        const rows = [];
        for (let offset = 0; ; offset += PAGE) {
            const page = await get(`/rest/v1/${table}?select=*&order=${order}&offset=${offset}&limit=${PAGE}`);
            rows.push(...page);
            if (page.length < PAGE) break;
        }
        total += rows.length;
        process.stdout.write(`  ${table}: ${rows.length}\n`);
        if (rows.length === 0) continue;
        // Only the columns live sends, so local-only columns keep their defaults.
        const cols = columns.filter((c) => c in rows[0]).map(ident).join(', ');
        statements.push(`insert into public.${ident(table)} (${cols}) overriding system value
  select ${cols} from json_populate_recordset(null::public.${ident(table)}, ${literal(JSON.stringify(rows))});`);
    }

    const users = [];
    for (let page = 1; ; page++) {
        const batch = (await get(`/auth/v1/admin/users?page=${page}&per_page=${PAGE}`)).users ?? [];
        users.push(...batch);
        if (batch.length < PAGE) break;
    }
    console.log(`  sign-in accounts: ${users.length}`);
    const identities = users.flatMap((u) => u.identities ?? []);

    const sql = `truncate ${tables.map((t) => `public.${ident(t)}`).join(', ')}, auth.users cascade;
${statements.join('\n')}
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, phone, phone_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at, is_anonymous,
                        confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
                        phone_change, phone_change_token, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', u.id, coalesce(u.aud, 'authenticated'), coalesce(u.role, 'authenticated'),
       u.email, extensions.crypt(${literal(password)}, extensions.gen_salt('bf')), coalesce(u.email_confirmed_at, now()),
       nullif(u.phone, ''), u.phone_confirmed_at, coalesce(u.app_metadata, '{}'), coalesce(u.user_metadata, '{}'),
       u.created_at, u.updated_at, u.last_sign_in_at, coalesce(u.is_anonymous, false), '', '', '', '', '', '', '', ''
  from json_to_recordset(${literal(JSON.stringify(users))}) as u(id uuid, aud text, role text, email text, email_confirmed_at timestamptz,
       phone text, phone_confirmed_at timestamptz, app_metadata jsonb, user_metadata jsonb, created_at timestamptz,
       updated_at timestamptz, last_sign_in_at timestamptz, is_anonymous boolean);
insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select coalesce(i.identity_id, gen_random_uuid()), i.id, i.user_id, i.identity_data, i.provider, i.last_sign_in_at, i.created_at, i.updated_at
  from json_to_recordset(${literal(JSON.stringify(identities))}) as i(identity_id uuid, id text, user_id uuid, identity_data jsonb,
       provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
-- Sequences: owned ones follow their column; product codes continue after the highest number.
do $$
declare r record;
begin
  for r in select c.relname as tbl, a.attname as col, pg_get_serial_sequence(format('public.%I', c.relname), a.attname) as seq
             from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid
            where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped loop
    if r.seq is not null then
      execute format('select setval(%L, coalesce((select max(%I) from public.%I), 0) + 1, false)', r.seq, r.col, r.tbl);
    end if;
  end loop;
  perform setval('public.product_code_seq',
                 coalesce((select max(substring(code from '(\\d+)$')::int) from public.products), 0) + 1, false);
end $$;`;
    writeFileSync(DUMP, sql);
    console.log(`Loading ${total} rows into ${tables.length} tables…`);
    restoreLocal(sql);
    console.log(`Every account's local password: ${password}`);
}
