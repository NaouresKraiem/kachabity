import { ok, route } from '@/lib/erp/api';
import { listTeam } from '@/lib/erp/team';

export const dynamic = 'force-dynamic';

/** Team members for "assign to" pickers (any back-office user): id, e-mail, role and permissions. */
export const GET = route('admin-staff', async () => ok(await listTeam()));
