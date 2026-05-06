import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

export interface CreateDatabaseClientOptions {
  readonly connectionString: string;
  readonly max?: number;
  readonly idleTimeout?: number;
  readonly ssl?: 'require' | 'allow' | 'prefer' | boolean;
}

export interface DatabaseHandle {
  readonly db: Database;
  readonly sql: Sql;
  readonly close: () => Promise<void>;
}

export function createDatabaseClient(options: CreateDatabaseClientOptions): DatabaseHandle {
  const sql = postgres(options.connectionString, {
    max: options.max ?? 10,
    idle_timeout: options.idleTimeout ?? 20,
    ...(options.ssl !== undefined ? { ssl: options.ssl } : {}),
  });
  const db = drizzle(sql, { schema });
  return {
    db,
    sql,
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}
