/**
 * Wait for the database to accept connections. On boot (outside docker-compose,
 * which gates the app on a Postgres healthcheck) the database may not be ready
 * for a few seconds; without this, boot migrations fail once and the app starts
 * with no schema. Retries a lightweight ping with a fixed delay.
 */
import postgres from 'postgres';

export interface WaitOptions {
  connectionString?: string;
  /** Total ping attempts before giving up. Default 15. */
  attempts?: number;
  /** Delay between attempts in ms. Default 1000. */
  delayMs?: number;
  logger?: (msg: string) => void;
  /** Test seam: a single readiness probe (defaults to a real `SELECT 1`). */
  ping?: () => Promise<void>;
  /** Test seam: the inter-attempt delay. */
  sleep?: (ms: number) => Promise<void>;
}

/** One real connection + `SELECT 1`, always closing the connection. */
async function pingOnce(connectionString: string): Promise<void> {
  const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
  try {
    await sql`SELECT 1`;
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
}

/** Resolve true once the database answers, or false after all attempts fail. */
export async function waitForDatabase(opts: WaitOptions = {}): Promise<boolean> {
  const attempts = opts.attempts ?? 15;
  const delayMs = opts.delayMs ?? 1000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const connectionString = opts.connectionString ?? process.env.DATABASE_URL ?? '';
  const ping = opts.ping ?? (() => pingOnce(connectionString));

  if (!connectionString) return false;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await ping();
      return true;
    } catch {
      if (attempt < attempts) {
        opts.logger?.(`database not ready (attempt ${attempt}/${attempts}), retrying`);
        await sleep(delayMs);
      }
    }
  }
  return false;
}
