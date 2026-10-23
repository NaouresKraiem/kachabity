import { Global, Module, OnModuleDestroy, Injectable } from '@nestjs/common';
import { Kysely, PostgresDialect, sql, type Transaction } from 'kysely';
import { Pool } from 'pg';
import { config } from '../config';
import type { DB } from './types';

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

  async onModuleDestroy() {
    await this.destroy();
  }
}

@Global()
@Module({ providers: [Database], exports: [Database] })
export class DatabaseModule {}
