import { Global, Module, OnModuleDestroy, Injectable } from '@nestjs/common';
import { Kysely, PostgresDialect, sql, type Transaction } from 'kysely';
import { Pool, types } from 'pg';
import { config } from '../config';
import type { DB } from './types';

// Return values the way PostgREST did, so the JSON the admin and storefront get doesn't change:
// numbers for numeric/int8, and dates/timestamps as their JSON text (2026-10-23T14:35:28.5+00:00).
types.setTypeParser(types.builtins.NUMERIC, parseFloat);
types.setTypeParser(types.builtins.INT8, Number);
types.setTypeParser(types.builtins.DATE, (value) => value);
types.setTypeParser(types.builtins.TIMESTAMP, (value) =>
  value.replace(' ', 'T'),
);
types.setTypeParser(types.builtins.TIMESTAMPTZ, (value) =>
  value.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'),
);

export interface Actor {
  userId: string;
  email: string | null;
  role: string;
}

/**
 * The database. This connection bypasses RLS like the service role did, so every read must
 * filter `deleted_at is null` itself. Writes go through withActor().
 */
@Injectable()
export class Database extends Kysely<DB> implements OnModuleDestroy {
  constructor() {
    super({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString: config.DATABASE_URL, max: 10 }),
      }),
    });
  }

  /**
   * Opens a write transaction that carries the staff member. The activity log
   * (private.log_activity → private.trusted_request_headers) reads these two settings exactly as
   * PostgREST sets them; `true` keeps them local to the transaction on a pooled connection.
   */
  withActor<T>(
    actor: Actor | null,
    work: (trx: Transaction<DB>) => Promise<T>,
  ): Promise<T> {
    // null: a write with no staff member (checkout, webhooks). Like the old service-role requests,
    // it carries no actor, so the activity log skips it instead of logging a database edit.
    const headers = actor
      ? {
          'x-actor-id': actor.userId,
          'x-actor-email': actor.email,
          'x-actor-role': actor.role,
        }
      : {};
    return this.transaction().execute(async (trx) => {
      await sql`select set_config('request.jwt.claims', ${JSON.stringify({ role: 'service_role' })}, true),
                       set_config('request.headers', ${JSON.stringify(headers)}, true)`.execute(
        trx,
      );
      return work(trx);
    });
  }

  /**
   * Calls a public database function with named arguments, like supabase.rpc(name, params):
   * `select public.name(p_a => $1, ...)`. Values are encoded by the parameter's declared type
   * (json/jsonb as JSON text, arrays as Postgres arrays). Pass `trx` (from withActor) for writes.
   */
  async call<T = unknown>(
    name: string,
    params: Record<string, unknown> = {},
    trx: Kysely<DB> = this,
  ): Promise<T> {
    const { call, returnsRow } = await this.callOf(name, params);
    // A function returning a table row (e.g. set_order_status → orders) comes back as a JSON
    // object, as PostgREST returned it, instead of Postgres's row text.
    const query = returnsRow
      ? sql<{ result: T }>`select to_jsonb(r) as result from ${call} r`
      : sql<{ result: T }>`select ${call} as result`;
    return (await query.execute(trx)).rows[0]?.result;
  }

  /** Like call() for functions that return a table: `select * from public.name(...)`. */
  async callRows<T = Record<string, unknown>>(
    name: string,
    params: Record<string, unknown> = {},
    trx: Kysely<DB> = this,
  ): Promise<T[]> {
    const { call } = await this.callOf(name, params);
    return (await sql<T>`select * from ${call}`.execute(trx)).rows;
  }

  // Per function, read once: parameter name → type (jsonb, _uuid, text…) and whether it returns a row.
  private readonly signatures = new Map<
    string,
    Promise<{ params: Map<string, string>; returnsRow: boolean }>
  >();

  private signature(name: string) {
    if (!this.signatures.has(name)) {
      const params = sql<{ parameter_name: string; udt_name: string }>`
        select p.parameter_name, p.udt_name
          from information_schema.routines r
          join information_schema.parameters p on p.specific_name = r.specific_name
         where r.routine_schema = 'public' and r.routine_name = ${name} and p.parameter_mode in ('IN', 'INOUT')`.execute(
        this,
      );
      const returns = sql<{ typtype: string; proretset: boolean }>`
        select t.typtype, p.proretset
          from pg_proc p join pg_type t on t.oid = p.prorettype
         where p.proname = ${name} and p.pronamespace = 'public'::regnamespace`.execute(
        this,
      );
      this.signatures.set(
        name,
        Promise.all([params, returns]).then(([p, r]) => ({
          params: new Map(
            p.rows.map((row) => [row.parameter_name, row.udt_name]),
          ),
          returnsRow: r.rows.some(
            (row) => row.typtype === 'c' && !row.proretset,
          ),
        })),
      );
    }
    return this.signatures.get(name)!;
  }

  private async callOf(name: string, params: Record<string, unknown>) {
    if (!/^[a-z_][a-z0-9_]*$/.test(name))
      throw new Error(`Bad function name ${name}`);
    const signature = await this.signature(name);
    const args = Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => {
        const type = signature.params.get(key);
        if (!type) throw new Error(`${name} has no parameter ${key}`);
        const isJson = (type === 'json' || type === 'jsonb') && value !== null;
        return sql`${sql.raw(key)} => ${isJson ? JSON.stringify(value) : value}`;
      });
    return {
      call: sql`public.${sql.raw(name)}(${args.length ? sql.join(args) : sql``})`,
      returnsRow: signature.returnsRow,
    };
  }

  async onModuleDestroy() {
    await this.destroy();
  }
}

@Global()
@Module({ providers: [Database], exports: [Database] })
export class DatabaseModule {}
