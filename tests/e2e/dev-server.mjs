// Starts the site for the end-to-end suites on http://localhost:3001 against the LOCAL Supabase
// (`npx supabase start`). Every variable of .env.local (live Supabase, Gmail, Colissimo, Meta,
// Sentry…) is blanked first, so a test run can never reach a live service; then only the local
// Supabase URL and keys are set. Usage: node tests/e2e/dev-server.mjs
import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const status = JSON.parse(execSync('npx -y supabase@2.121.0 status -o json', { encoding: 'utf8' }));
const blanked = existsSync('.env.local')
    ? Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1]).filter(Boolean).map((k) => [k, '']))
    : {};
const env = {
    ...process.env,
    ...blanked,
    ENV: 'local',
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    NODE_OPTIONS: '--network-family-autoselection-attempt-timeout=2000',
    // Next.js then skips .env files altogether (it would otherwise refill the blanked variables).
    __NEXT_PROCESSED_ENV: 'true',
};
if (!/localhost|127\.0\.0\.1/.test(status.API_URL ?? '')) throw new Error('Local Supabase is not running: npx supabase start');
console.log(`Tests: SUPABASE_ANON_KEY=${status.ANON_KEY} SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}`);
spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'dev', '--turbopack', '-p', '3001'], { env, stdio: 'inherit', shell: process.platform === 'win32' });
