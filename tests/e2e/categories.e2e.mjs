// Categories (the NestJS pilot) and the access rules every ported route must keep.
import { admin, APP, done, ok, user } from './helpers.mjs';

const owner = await user('owner@test.local', { role: 'owner' });
const editor = await user('editor@test.local', { role: 'staff', permissions: ['products'] });
const cashier = await user('cashier@test.local', { role: 'staff', permissions: ['pos'] });
const anonymous = (path, method = 'GET', body, headers = {}) =>
    fetch(`${APP}${path}`, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });

const name = `E2E category ${Date.now()}`;

// Access
let r = await anonymous('/api/categories');
ok(r.status === 200 && Array.isArray((await r.json()).data), 'public list');
ok((await anonymous('/api/categories', 'POST', { name })).status === 401, 'no session: 401');
ok((await anonymous('/api/categories', 'POST', { name }, { 'x-admin-role': 'owner', 'x-admin-permissions': 'products' })).status === 401,
    'forged x-admin-* headers without a session are ignored');
ok((await cashier.call('/api/categories', 'POST', { name })).status === 403, 'staff without products: 403');

// Create, with the staff member in the activity log
r = await owner.call('/api/categories', 'POST', { name });
const created = r.json?.data;
ok(r.status === 201 && r.json.success && created?.slug === name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 'owner creates (201, slug)', r);
const [log] = await admin(`/rest/v1/activity_log?entity=eq.categories&entity_id=eq.${created?.id}&action=eq.create&select=actor_email,source`);
ok(log?.actor_email === 'owner@test.local' && log?.source === 'admin', 'activity log names the owner', log);

// Validation keeps the { success: false, error } shape
r = await owner.call('/api/categories', 'POST', {});
ok(r.status === 400 && r.json?.success === false && /Category name is required/.test(r.json.error), 'missing name: 400 with message', r.json);
r = await editor.call('/api/categories', 'PUT', { id: created?.id, parent_id: created?.id });
ok(r.status === 400 && r.json?.error === 'A category cannot be its own parent', 'own parent refused', r.json);

// Update and list
r = await editor.call('/api/categories', 'PUT', { id: created?.id, name: `${name} renamed`, name_ar: '' });
ok(r.status === 200 && r.json.data.name === `${name} renamed` && r.json.data.name_ar === null, 'staff with products renames', r.json);
const listed = (await (await anonymous('/api/categories')).json()).data.find((c) => c.id === created?.id);
ok(listed?.name === `${name} renamed`, 'list shows the new name', listed);

// Delete needs products + delete, and only soft-deletes
ok((await editor.call(`/api/categories?id=${created?.id}`, 'DELETE')).status === 403, 'staff without delete: 403');
// Middleware (when it refuses first) logs after answering, so give the row a moment.
let refusal;
for (let i = 0; i < 15 && refusal?.label !== 'DELETE /api/categories'; i++) {
    if (i) await new Promise((resolve) => setTimeout(resolve, 200));
    [refusal] = await admin(`/rest/v1/activity_log?action=eq.access_denied&actor_email=eq.editor@test.local&order=created_at.desc&limit=1&select=label`);
}
ok(refusal?.label === 'DELETE /api/categories', 'refusal is logged', refusal);
r = await owner.call(`/api/categories?ids=${created?.id}`, 'DELETE');
ok(r.status === 200 && r.json.success, 'owner deletes', r.json);
const [row] = await admin(`/rest/v1/categories?id=eq.${created?.id}&select=deleted_at`);
ok(row?.deleted_at, 'row kept with deleted_at', row);
ok(!(await (await anonymous('/api/categories')).json()).data.some((c) => c.id === created?.id), 'deleted category left the list');

done();
