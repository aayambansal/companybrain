import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { registerAll } from '@companybrain/connectors';
import { getEnv, type Variables } from './context.js';
import { getConnectorRegistry } from './connectors/registry.js';
import { requireAuth } from './auth.js';
import { openapiDocument, docsPage } from './openapi.js';
import health from './routes/health.js';
import status from './routes/status.js';
import auth from './routes/auth.js';
import memories from './routes/memories.js';
import search from './routes/search.js';
import chat from './routes/chat.js';
import playbooks from './routes/playbooks.js';
import topics from './routes/topics.js';
import digest from './routes/digest.js';
import spaces from './routes/spaces.js';
import connections from './routes/connections.js';
import apikeys from './routes/apikeys.js';
import providers from './routes/providers.js';
import reindex from './routes/reindex.js';
import analytics from './routes/analytics.js';
import backup from './routes/backup.js';
import slack from './routes/slack.js';
import webhooks from './routes/webhooks.js';

export function createApp() {
  const env = getEnv();

  // Register the built-in connectors + sync runner so the Connections page and
  // /v1/connections/* endpoints have something to offer.
  registerAll(getConnectorRegistry());

  const app = new Hono<{ Variables: Variables }>();

  app.use('*', logger());
  // Browsers reject `Access-Control-Allow-Origin: *` together with credentials,
  // so when the allow-list is a wildcard we reflect the request's own origin.
  const allowAny = env.corsOrigins.includes('*');
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (allowAny) return origin ?? '*';
        return env.corsOrigins.includes(origin) ? origin : (env.corsOrigins[0] ?? '');
      },
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );

  // Public
  app.route('/health', health);
  app.get('/', (c) => c.json({ name: 'companybrain', version: env.version, docs: '/docs' }));
  app.get('/docs', (c) => c.html(docsPage));
  app.get('/v1/openapi.json', (c) => c.json(openapiDocument(env.version)));
  app.route('/v1/status', status);
  app.route('/v1/auth', auth);
  // Slack slash command: public, authenticated by the Slack signing secret.
  app.route('/v1/integrations/slack', slack);

  // Authenticated
  const v1 = new Hono<{ Variables: Variables }>();
  v1.use('*', requireAuth);
  v1.route('/memories', memories);
  v1.route('/search', search);
  v1.route('/chat', chat);
  v1.route('/playbooks', playbooks);
  v1.route('/topics', topics);
  v1.route('/digest', digest);
  v1.route('/spaces', spaces);
  v1.route('/connections', connections);
  v1.route('/api-keys', apikeys);
  v1.route('/providers', providers);
  v1.route('/reindex', reindex);
  v1.route('/analytics', analytics);
  v1.route('/backup', backup);
  v1.route('/webhooks', webhooks);
  app.route('/v1', v1);

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((err, c) => {
    console.error('[api] error:', err);
    return c.json({ error: 'internal_error', message: String(err?.message ?? err) }, 500);
  });

  return app;
}
