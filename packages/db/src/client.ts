/**
 * Postgres client + Drizzle instance for CompanyBrain.
 *
 * Usage:
 *   import { createDb } from '@companybrain/db';
 *   const { db, sql } = createDb(process.env.DATABASE_URL!);
 */
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

export interface DbClient {
  db: Database;
  sql: Sql;
  /** Close the underlying connection pool. */
  close: () => Promise<void>;
}

export interface CreateDbOptions {
  /** Max connections in the pool. Default 10. */
  max?: number;
  /** Idle timeout (seconds). Default 20. */
  idleTimeout?: number;
  /** Enable query logging. */
  debug?: boolean;
}

/**
 * Create a Drizzle client bound to the given connection string.
 * Reuse a single instance per process where possible.
 */
export function createDb(connectionString: string, opts: CreateDbOptions = {}): DbClient {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to create the CompanyBrain database client.');
  }
  const sql = postgres(connectionString, {
    max: opts.max ?? 10,
    idle_timeout: opts.idleTimeout ?? 20,
    // pgvector returns vectors as strings; postgres-js handles them fine as text.
    prepare: false,
  });
  const db = drizzle(sql, { schema, logger: opts.debug ?? false });
  return {
    db,
    sql,
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}

let singleton: DbClient | null = null;

/**
 * Lazily create (and memoize) a client from `process.env.DATABASE_URL`.
 * Convenient for apps that use a single global connection.
 */
export function getDb(): DbClient {
  if (!singleton) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL environment variable is not set.');
    singleton = createDb(url);
  }
  return singleton;
}
