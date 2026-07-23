/** Hand-authored OpenAPI 3.1 document for the CompanyBrain API. */
export function openapiDocument(version: string): Record<string, unknown> {
  const bearer = [{ bearerAuth: [] }];
  const json = (schema: unknown) => ({ 'application/json': { schema } });
  return {
    openapi: '3.1.0',
    info: {
      title: 'CompanyBrain API',
      version,
      description:
        'The open-source memory layer for your company. Index everything, recall anything.',
      license: { name: 'MIT' },
    },
    servers: [{ url: '/', description: 'this server' }],
    security: bearer,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'API key (cb_...) or session JWT.',
        },
      },
    },
    paths: {
      '/health': {
        get: { summary: 'Liveness', security: [], responses: { 200: { description: 'ok' } } },
      },
      '/v1/status': {
        get: {
          summary: 'Build info, provider config, and org counts',
          responses: { 200: { description: 'status' } },
        },
      },
      '/v1/auth/register': {
        post: {
          summary: 'Create an organization and its first owner',
          security: [],
          requestBody: {
            content: json({
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string' },
                password: { type: 'string' },
                name: { type: 'string' },
                orgName: { type: 'string' },
              },
            }),
          },
          responses: { 201: { description: 'created' }, 409: { description: 'email taken' } },
        },
      },
      '/v1/auth/login': {
        post: {
          summary: 'Log in, returns a session token + sets a cookie',
          security: [],
          requestBody: {
            content: json({
              type: 'object',
              required: ['email', 'password'],
              properties: { email: { type: 'string' }, password: { type: 'string' } },
            }),
          },
          responses: { 200: { description: 'ok' }, 401: { description: 'invalid credentials' } },
        },
      },
      '/v1/auth/me': {
        get: { summary: 'Current org + user', responses: { 200: { description: 'ok' } } },
      },
      '/v1/memories': {
        get: {
          summary: 'List memories',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'offset', in: 'query', schema: { type: 'integer' } },
            { name: 'spaceId', in: 'query', schema: { type: 'string' } },
            { name: 'connector', in: 'query', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'ok' } },
        },
        post: {
          summary: 'Add a memory',
          requestBody: {
            content: json({
              type: 'object',
              required: ['content'],
              properties: {
                title: { type: 'string' },
                content: { type: 'string' },
                format: { type: 'string', enum: ['text', 'markdown', 'html'] },
                space: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                sourceUrl: { type: 'string' },
                metadata: { type: 'object' },
              },
            }),
          },
          responses: { 201: { description: 'created' } },
        },
      },
      '/v1/memories/{id}': {
        get: {
          summary: 'Get a memory',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'ok' }, 404: { description: 'not found' } },
        },
        patch: {
          summary: 'Update a memory',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'ok' } },
        },
        delete: {
          summary: 'Delete a memory',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'ok' } },
        },
      },
      '/v1/search': {
        get: {
          summary: 'Search memories',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
            {
              name: 'mode',
              in: 'query',
              schema: { type: 'string', enum: ['hybrid', 'semantic', 'keyword'] },
            },
            { name: 'space', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
          ],
          responses: { 200: { description: 'ranked hits' } },
        },
        post: {
          summary: 'Search with a JSON body',
          requestBody: {
            content: json({
              type: 'object',
              required: ['q'],
              properties: {
                q: { type: 'string' },
                mode: { type: 'string' },
                space: { type: 'string' },
                limit: { type: 'integer' },
                tags: { type: 'array', items: { type: 'string' } },
              },
            }),
          },
          responses: { 200: { description: 'ranked hits' } },
        },
      },
      '/v1/chat': {
        post: {
          summary: 'RAG answer with citations',
          requestBody: {
            content: json({
              type: 'object',
              required: ['message'],
              properties: {
                message: { type: 'string' },
                space: { type: 'string' },
                limit: { type: 'integer' },
              },
            }),
          },
          responses: { 200: { description: 'answer' } },
        },
      },
      '/v1/chat/stream': {
        post: {
          summary: 'RAG answer, streamed over SSE',
          responses: { 200: { description: 'text/event-stream' } },
        },
      },
      '/v1/playbooks': {
        post: {
          summary: 'Synthesize a cited playbook from memories on a topic',
          requestBody: {
            content: json({
              type: 'object',
              required: ['topic'],
              properties: {
                topic: { type: 'string' },
                space: { type: 'string' },
                spaceId: { type: 'string' },
                limit: { type: 'integer' },
                save: { type: 'boolean' },
              },
            }),
          },
          responses: { 201: { description: 'playbook' } },
        },
      },
      '/v1/topics': {
        get: {
          summary: 'Group memories by tag into topics',
          parameters: [
            { name: 'space', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'minCount', in: 'query', schema: { type: 'integer' } },
          ],
          responses: { 200: { description: 'topics' } },
        },
      },
      '/v1/spaces': {
        get: { summary: 'List spaces', responses: { 200: { description: 'ok' } } },
        post: { summary: 'Create a space', responses: { 201: { description: 'created' } } },
      },
      '/v1/connections': {
        get: { summary: 'List configured connections', responses: { 200: { description: 'ok' } } },
        post: { summary: 'Configure a connector', responses: { 201: { description: 'created' } } },
      },
      '/v1/connections/available': {
        get: {
          summary: 'List available connector types',
          responses: { 200: { description: 'ok' } },
        },
      },
      '/v1/connections/{id}/sync': {
        post: {
          summary: 'Trigger a sync',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 202: { description: 'started' }, 501: { description: 'no runner' } },
        },
      },
      '/v1/api-keys': {
        get: { summary: 'List API keys', responses: { 200: { description: 'ok' } } },
        post: {
          summary: 'Create an API key (secret shown once)',
          responses: { 201: { description: 'created' } },
        },
      },
    },
  };
}

/** A tiny, dependency-free docs page that renders the OpenAPI spec inline. */
export const docsPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>CompanyBrain API</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0a0a0b; color: #e7e7ea; font: 14px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; }
  header { padding: 28px 32px; border-bottom: 1px solid #1c1c22; }
  header pre { margin: 0; color: #8b5cf6; font-size: 11px; line-height: 1.2; }
  h1 { font-size: 18px; margin: 12px 0 2px; letter-spacing: .5px; }
  .sub { color: #8a8a94; }
  main { max-width: 920px; margin: 0 auto; padding: 24px 32px 80px; }
  .op { border: 1px solid #1c1c22; border-radius: 10px; margin: 10px 0; overflow: hidden; }
  .op summary { cursor: pointer; padding: 12px 16px; display: flex; gap: 12px; align-items: center; list-style: none; }
  .op summary::-webkit-details-marker { display: none; }
  .m { font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; }
  .get { background: #16351f; color: #6ee7a0; } .post { background: #172a45; color: #6cb8ff; }
  .patch { background: #3a2f10; color: #ffd166; } .delete { background: #3a1620; color: #ff8fa3; }
  .path { color: #e7e7ea; } .desc { color: #8a8a94; margin-left: auto; font-size: 12px; }
  .body { padding: 0 16px 14px; color: #b6b6bf; }
  code { color: #c4b5fd; }
  a { color: #8b5cf6; }
</style>
</head>
<body>
<header>
<pre>       _---~~(~~-_.
     _{        )   )
   ,   ) -~~- ( ,-' )_
  (  \`-,_..\`., )-- '_,)
 ( \` _)  (  -~( -_ \`,  }
 (_-  _  ~_-~~~~\`,  ,' )
   \`~ -^(    __;-,((()))
         ~~~~ {_ -_(())</pre>
<h1>CompanyBrain API</h1>
<div class="sub">Authenticate with <code>Authorization: Bearer cb_...</code>. Full spec at <a href="/v1/openapi.json">/v1/openapi.json</a>.</div>
</header>
<main id="ops">Loading spec…</main>
<script>
fetch('/v1/openapi.json').then(r => r.json()).then(spec => {
  const el = document.getElementById('ops');
  el.innerHTML = '';
  const paths = spec.paths || {};
  for (const [p, methods] of Object.entries(paths)) {
    for (const [m, op] of Object.entries(methods)) {
      const d = document.createElement('details');
      d.className = 'op';
      d.innerHTML =
        '<summary><span class="m ' + m + '">' + m + '</span>' +
        '<span class="path">' + p + '</span>' +
        '<span class="desc">' + (op.summary || '') + '</span></summary>' +
        '<div class="body">' + (op.description || op.summary || '') + '</div>';
      el.appendChild(d);
    }
  }
});
</script>
</body>
</html>`;
