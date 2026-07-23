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
import spaces from './routes/spaces.js';
import connections from './routes/connections.js';
import apikeys from './routes/apikeys.js';
import providers from './routes/providers.js';
import reindex from './routes/reindex.js';

export function createApp() {
  const env = getEnv();

  // Register the built-in connectors + sync runner so the Connections page and
  // /v1/connections/* endpoints have something to offer.
  registerAll(getConnectorRegistry());

  const app = new Hono<{ Variables: Variables }>();

  app.use('*', logger());
  app.use(
    '*',
    cors({
      origin: env.corsOrigins.includes('*') ? '*' : env.corsOrigins,
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

  // Authenticated
  const v1 = new Hono<{ Variables: Variables }>();
  v1.use('*', requireAuth);
  v1.route('/memories', memories);
  v1.route('/search', search);
  v1.route('/chat', chat);
  v1.route('/spaces', spaces);
  v1.route('/connections', connections);
  v1.route('/api-keys', apikeys);
  v1.route('/providers', providers);
  v1.route('/reindex', reindex);
  app.route('/v1', v1);

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((err, c) => {
    console.error('[api] error:', err);
    return c.json({ error: 'internal_error', message: String(err?.message ?? err) }, 500);
  });

  return app;
}
