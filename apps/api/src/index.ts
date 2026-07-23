import { serve } from '@hono/node-server';
import { runMigrations, organizations } from '@companybrain/db';
import { createApp } from './app.js';
import { getEngine, getEnv, ensureDefaultOrg } from './context.js';
import { applyProviders } from './routes/providers.js';
import { startScheduler } from './scheduler.js';
import { banner } from './banner.js';

async function main() {
  const env = getEnv();

  // Auto-migrate on boot unless disabled. Keeps `docker compose up` a one-liner.
  if (process.env.AUTO_MIGRATE !== 'false') {
    try {
      await runMigrations({ logger: () => {} });
    } catch (err) {
      console.error('[api] migration failed:', err);
    }
  }

  const engine = getEngine();

  // Apply any persisted provider settings (keys picked in the dashboard).
  try {
    if (env.authMode === 'single') {
      const orgId = await ensureDefaultOrg();
      await applyProviders(orgId);
    } else {
      const rows = await engine.db
        .select({ id: organizations.id, settings: organizations.settings })
        .from(organizations);
      const withProviders = rows.find(
        (r) => (r.settings as Record<string, unknown> | undefined)?.providers,
      );
      if (withProviders) await applyProviders(withProviders.id);
    }
  } catch (err) {
    console.error('[api] provider settings not applied:', err);
  }

  const app = createApp();

  // Periodic connector syncs (opt-in per connection via syncIntervalMinutes).
  if (process.env.DISABLE_SCHEDULER !== 'true') startScheduler();

  serve({ fetch: app.fetch, hostname: env.host, port: env.port }, () => {
    process.stdout.write(
      banner({
        version: env.version,
        port: env.port,
        embedding: `${engine.embedder.name} (${engine.embedder.model})`,
        llm: `${engine.llm.name} (${engine.llm.model})`,
      }),
    );
  });
}

main().catch((err) => {
  console.error('[api] fatal:', err);
  process.exit(1);
});
