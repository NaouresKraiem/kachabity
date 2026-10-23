// Creates (or resets) the local owner account for the Docker setup (docs/DOCKER.md):
// admin@kachabity.local with LOCAL_PASSWORD from .env.docker. Local Supabase only.
// Usage: node scripts/docker/create-admin.mjs   (import-live-data.mjs runs it after each import)
import { existsSync, readFileSync } from 'node:fs';

const env = existsSync('.env.docker') ? readFileSync('.env.docker', 'utf8') : '';
const value = (name) => process.env[name] || env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim();
const SUPABASE = 'http://127.0.0.1:54321'; // never the live project
const key = value('SUPABASE_SERVICE_ROLE_KEY');
const password = value('LOCAL_PASSWORD') || 'Kachabity-local-1';
const email = 'admin@kachabity.local';
if (!key) throw new Error('Run npm run docker:env first (.env.docker has no SUPABASE_SERVICE_ROLE_KEY).');

const call = async (path, method = 'GET', body) => {
    const response = await fetch(`${SUPABASE}/auth/v1/admin${path}`, {
        method,
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: body && JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
    return response.json();
};

const account = { email, password, email_confirm: true, app_metadata: { role: 'owner' } };
const existing = [];
for (let page = 1; ; page++) {
    const users = (await call(`/users?page=${page}&per_page=1000`)).users ?? [];
    existing.push(...users);
    if (users.length < 1000) break;
}
const user = existing.find((u) => u.email === email);
if (user) await call(`/users/${user.id}`, 'PUT', account);
else await call('/users', 'POST', account);
console.log(`Local owner account: ${email} (password: LOCAL_PASSWORD in .env.docker)`);
