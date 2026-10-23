// Shared by the end-to-end suites. They sign in test users on a local Supabase and call the API
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

export async function user(email, appMeta) {
    const list = await admin('/auth/v1/admin/users?per_page=200');
    let u = (list.users ?? []).find((x) => x.email === email);
    if (!u) u = await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password: 'Test-pass-123!', email_confirm: true, app_metadata: appMeta }) });
    else await admin(`/auth/v1/admin/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ app_metadata: appMeta }) });
    const s = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Test-pass-123!' }) })).json();
    const ref = new URL(SUPA).hostname.split('.')[0];
    const value = `base64-${Buffer.from(JSON.stringify(s)).toString('base64url')}`;
    const chunks = value.match(/.{1,3180}/g);
    const cookie = chunks.length === 1 ? `sb-${ref}-auth-token=${value}` : chunks.map((c, i) => `sb-${ref}-auth-token.${i}=${c}`).join('; ');
    const call = async (path, method = 'GET', body) => {
        const r = await fetch(`${APP}${path}`, { method, headers: { cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
        let json = null;
        try { json = await r.json(); } catch { /* page */ }
        return { status: r.status, json, location: r.headers.get('location') };
    };
    await call('/api/admin/me'); // syncs back_office_users
    return { id: s.user?.id, call, cookie };
}
