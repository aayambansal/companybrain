import { serve } from '@hono/node-server';
import { runMigrations } from '@companybrain/db';
import { createApp } from './app.js';
import { getEngine, getEnv } from './context.js';
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
  const app = createApp();

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
