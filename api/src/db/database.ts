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
    actor: Actor,
    work: (trx: Transaction<DB>) => Promise<T>,
  ): Promise<T> {
    return this.transaction().execute(async (trx) => {
      await sql`select set_config('request.jwt.claims', ${JSON.stringify({ role: 'service_role' })}, true),
                       set_config('request.headers', ${JSON.stringify({
                         'x-actor-id': actor.userId,
                         'x-actor-email': actor.email,
                         'x-actor-role': actor.role,
                       })}, true)`.execute(trx);
      return work(trx);
    });
  }

  /**
   * Calls a public database function with named arguments, like supabase.rpc(name, params):
   * `select public.name(p_a => $1, ...)`. Objects and arrays are sent as JSON (jsonb parameters).
   * Pass `trx` (from withActor) for functions that write.
   */
  async call<T = unknown>(
    name: string,
    params: Record<string, unknown> = {},
    trx: Kysely<DB> = this,
  ): Promise<T> {
    const row = await sql<{
      result: T;
    }>`select ${callOf(name, params)} as result`
      .execute(trx)
      .then((r) => r.rows[0]);
    return row?.result;
  }

  /** Like call() for functions that return a table: `select * from public.name(...)`. */
  async callRows<T = Record<string, unknown>>(
    name: string,
    params: Record<string, unknown> = {},
    trx: Kysely<DB> = this,
  ): Promise<T[]> {
    return (await sql<T>`select * from ${callOf(name, params)}`.execute(trx))
      .rows;
  }

  async onModuleDestroy() {
    await this.destroy();
  }
}

function callOf(name: string, params: Record<string, unknown>) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name))
    throw new Error(`Bad function name ${name}`);
  const args = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if (!/^[a-z_][a-z0-9_]*$/.test(key))
        throw new Error(`Bad argument ${key}`);
      // Arrays of plain values go as Postgres arrays (uuid[], text[]); objects and arrays of
      // objects as JSON (jsonb). A jsonb parameter that takes an array of plain values needs
      // JSON.stringify() at the call site.
      const isPgArray =
        Array.isArray(value) &&
        value.every((v) => v === null || typeof v !== 'object');
      const isJson =
        value !== null &&
        typeof value === 'object' &&
        !(value instanceof Date) &&
        !isPgArray;
      return sql`${sql.raw(key)} => ${isJson ? JSON.stringify(value) : value}`;
    });
  return sql`public.${sql.raw(name)}(${args.length ? sql.join(args) : sql``})`;
}

@Global()
@Module({ providers: [Database], exports: [Database] })
export class DatabaseModule {}
