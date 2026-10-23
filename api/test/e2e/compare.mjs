// Parity check while porting: GETs the same paths from the Next.js route (NEXT_URL, the path must
// not be in NEST_ROUTES there) and from NestJS (NEST_URL), signed in as the test owner, and
// compares the JSON. Order inside nested arrays is ignored (PostgREST embeds have no set order).
// Usage: node test/e2e/compare.mjs /api/colors "/api/products?view=summary&admin=true" ...
import { ok, done, user } from './helpers.mjs';

const NEXT = process.env.NEXT_URL ?? 'http://localhost:3000';
const NEST = process.env.NEST_URL ?? 'http://localhost:4000';
const owner = await user('owner@test.local', { role: 'owner' });

const normalize = (value, depth = 0) => {
    if (Array.isArray(value)) {
        const items = value.map((v) => normalize(v, depth + 1));
        return depth > 2 ? items.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : items;
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map((k) => [k, normalize(value[k], depth + 1)]));
    }
    return value;
};

function firstDifference(a, b, path = '') {
    if (JSON.stringify(a) === JSON.stringify(b)) return null;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
            const found = firstDifference(a[key], b[key], `${path}.${key}`);
            if (found) return found;
        }
    }
    return { path: path || '(root)', next: JSON.stringify(a)?.slice(0, 160), nest: JSON.stringify(b)?.slice(0, 160) };
}

for (const path of process.argv.slice(2)) {
    const get = async (base) => {
        const r = await fetch(`${base}${path}`, { headers: { cookie: owner.cookie } });
        return { status: r.status, json: await r.json().catch(() => null) };
    };
    const [a, b] = await Promise.all([get(NEXT), get(NEST)]);
    const difference = a.status === b.status ? firstDifference(normalize(a.json), normalize(b.json)) : { status: [a.status, b.status] };
    ok(!difference, `${path} (${a.status}, ${Array.isArray(a.json?.data) ? a.json.data.length + ' rows' : 'object'})`, difference);
}
done();
