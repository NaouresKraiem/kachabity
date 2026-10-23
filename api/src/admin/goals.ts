import type { Database } from '../db/database';

// Port of lib/erp/goals.ts and lib/erp/team.ts: monthly goals and progress, measured with the
// same figures as the owner overview.

/** Live back-office users (kept in sync by GET /api/admin/me and the Team API). */
export function listTeam(db: Database) {
  return db
    .selectFrom('back_office_users')
    .select(['user_id', 'email', 'role', 'permissions'])
    .where('deleted_at', 'is', null)
    .orderBy('email')
    .execute();
}

/** [start, end) of a month (YYYY-MM) in Tunis time (UTC+1, no daylight saving). */
export function monthRange(month: string) {
  const start = new Date(`${month}-01T00:00:00+01:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

/** The whole business against its goal for a month (website, agents, till). */
export async function teamProgress(db: Database, month: string) {
  const { start, end } = monthRange(month);
  const [goal, data] = await Promise.all([
    db
      .selectFrom('business_goals')
      .selectAll()
      .where('month', '=', `${month}-01`)
      .where('deleted_at', 'is', null)
      .executeTakeFirst(),
    db.call<{ orders: Record<string, number>; money: Record<string, number> }>(
      'owner_overview',
      {
        p_from: start.toISOString(),
        p_to: end.toISOString(),
        p_channel: null,
        p_agent: null,
        p_product: null,
        p_campaign: null,
      },
    ),
  ]);
  const delivered = Number(data.orders.delivered);
  const returned = Number(data.orders.returned);
  const total = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return {
    goal: goal ?? null,
    created: Number(data.orders.created),
    confirmed: Number(data.orders.confirmed),
    delivered,
    returned,
    delivered_revenue: Number(data.money.delivered_revenue),
    gross_margin: Number(data.money.gross_margin),
    ad_spend: Number(data.money.ad_spend),
    return_rate:
      delivered + returned
        ? Math.round((returned / (delivered + returned)) * 1000) / 10
        : null,
    days_in_month: total,
    days_elapsed: Math.max(
      0,
      Math.min(total, Math.ceil((Date.now() - start.getTime()) / 86_400_000)),
    ),
  };
}

/**
 * Each team member's objective and results for a month: the orders they handle (assigned, else
 * entered) created, confirmed and delivered in the month, and their commission.
 */
export async function monthProgress(
  db: Database,
  month: string,
  onlyUser?: string,
) {
  const { start, end } = monthRange(month);
  const since = start.toISOString();
  let orders = db
    .selectFrom('orders')
    .select([
      'assigned_to',
      'created_by',
      'created_at',
      'confirmed_at',
      'delivered_at',
      'status',
      'total',
    ])
    .where('deleted_at', 'is', null)
    .where((eb) =>
      eb.or([
        eb('created_at', '>=', since),
        eb('confirmed_at', '>=', since),
        eb('delivered_at', '>=', since),
      ]),
    );
  if (onlyUser) {
    orders = orders.where((eb) =>
      eb.or([
        eb('assigned_to', '=', onlyUser),
        eb.and([
          eb('assigned_to', 'is', null),
          eb('created_by', '=', onlyUser),
        ]),
      ]),
    );
  }
  const [team, goals, orderRows] = await Promise.all([
    listTeam(db),
    db
      .selectFrom('agent_goals')
      .selectAll()
      .where('month', '=', `${month}-01`)
      .where('deleted_at', 'is', null)
      .execute(),
    orders.execute(),
  ]);
  const inMonth = (d: string | null) =>
    !!d && new Date(d) >= start && new Date(d) < end;
  return team
    .filter((member) => !onlyUser || member.user_id === onlyUser)
    .map((member) => {
      const mine = orderRows.filter(
        (o) => (o.assigned_to ?? o.created_by) === member.user_id,
      );
      const delivered = mine.filter(
        (o) => o.status === 'delivered' && inMonth(o.delivered_at),
      );
      const revenue = delivered.reduce((s, o) => s + Number(o.total), 0);
      const goal = goals.find((g) => g.user_id === member.user_id) ?? null;
      const commission = !goal
        ? 0
        : goal.commission_type === 'percent'
          ? Math.round(revenue * Number(goal.commission_value) * 10) / 1000
          : goal.commission_type === 'per_order'
            ? delivered.length * Number(goal.commission_value)
            : 0;
      return {
        user_id: member.user_id,
        email: member.email,
        role: member.role,
        goal,
        created: mine.filter((o) => inMonth(o.created_at)).length,
        confirmed: mine.filter((o) => inMonth(o.confirmed_at)).length,
        delivered: delivered.length,
        delivered_revenue: revenue,
        commission,
      };
    });
}
