import { hashSync } from 'bcryptjs';

// Shared by the end-to-end suites. They sign in test users through /api/auth and call the API
// through APP_URL, so they test whichever server answers (Next.js, or NestJS through NEST_ROUTES).
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (local values from `supabase status`),
// APP_URL (default http://localhost:3000). Never point them at the live project: they write data.
export const SUPA = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
export const ANON = process.env.SUPABASE_ANON_KEY;
export const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const APP = process.env.APP_URL ?? 'http://localhost:3000';
if (!ANON || !SERVICE) throw new Error('Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY');
if (!/127\.0\.0\.1|localhost/.test(SUPA)) throw new Error('The e2e suites only run against a local Supabase');

let failures = 0;
export const ok = (cond, label, extra) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && extra !== undefined ? '  ' + JSON.stringify(extra).slice(0, 400) : ''}`);
    if (!cond) failures++;
};
export const done = () => {
    console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
    process.exit(failures ? 1 : 0);
};

export const admin = async (path, init = {}) => {
    const r = await fetch(`${SUPA}${path}`, { ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } });
    const text = await r.text();
    try { return JSON.parse(text); } catch { return text; }
};

const PASSWORD = 'Test-pass-123!';
const PASSWORD_HASH = hashSync(PASSWORD, 10);

/** A confirmed account with these app_metadata (role, permissions), signed in through /api/auth/sign-in. */
export async function user(email, appMeta = {}) {
    const account = { app_metadata: appMeta, password_hash: PASSWORD_HASH, email_confirmed_at: new Date().toISOString() };
    const updated = await admin(`/rest/v1/users?email=eq.${encodeURIComponent(email)}&deleted_at=is.null`, { method: 'PATCH', body: JSON.stringify(account) });
    if (!Array.isArray(updated) || updated.length === 0)
        await admin('/rest/v1/users', { method: 'POST', body: JSON.stringify({ ...account, email, name: email.split('@')[0] }) });
    const signIn = await fetch(`${APP}/api/auth/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
    const s = await signIn.json();
    if (!signIn.ok) throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(s)}`);
    const cookie = signIn.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    const call = async (path, method = 'GET', body) => {
        const r = await fetch(`${APP}${path}`, { method, headers: { cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
        let json = null;
        try { json = await r.json(); } catch { /* page */ }
        return { status: r.status, json, location: r.headers.get('location') };
    };
    await call('/api/admin/me'); // syncs back_office_users
    return { id: s.data?.id, call, cookie };
}
