/**
 * Lightweight SQL migration runner.
 *
 * Applies every `*.sql` file in `migrations/` in lexical order, exactly once,
 * tracking applied files in a `__cb_migrations` table. This gives us full
 * control over pgvector / tsvector DDL that Drizzle can't express natively.
 *
 * Run with: `pnpm --filter @companybrain/db migrate`
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

export interface MigrateOptions {
  connectionString?: string;
  migrationsDir?: string;
  logger?: (msg: string) => void;
}

export async function runMigrations(opts: MigrateOptions = {}): Promise<string[]> {
  const connectionString = opts.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to run migrations.');
  const dir = opts.migrationsDir ?? MIGRATIONS_DIR;
  const log = opts.logger ?? ((m: string) => console.log(`[migrate] ${m}`));

  const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
  const applied: string[] = [];
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS __cb_migrations (
        id serial PRIMARY KEY,
        name text NOT NULL UNIQUE,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    const files = (await readdir(dir))
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    const done = new Set(
      (await sql<{ name: string }[]>`SELECT name FROM __cb_migrations`).map((r) => r.name),
    );

    for (const file of files) {
      if (done.has(file)) {
        log(`skip ${file} (already applied)`);
        continue;
      }
      const content = await readFile(join(dir, file), 'utf8');
      log(`applying ${file} …`);
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`INSERT INTO __cb_migrations (name) VALUES (${file})`;
      });
      applied.push(file);
      log(`applied ${file}`);
    }

    if (applied.length === 0) log('database is up to date.');
    else log(`applied ${applied.length} migration(s).`);
    return applied;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Allow running directly: `tsx src/migrate.ts`
const entry = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
const invokedDirectly = entry.endsWith('/migrate.ts') || entry.endsWith('/migrate.js');
if (invokedDirectly || process.env.CB_RUN_MIGRATIONS === '1') {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] failed:', err);
      process.exit(1);
    });
}
