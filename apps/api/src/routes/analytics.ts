import { Hono } from 'hono';
import { getEngine, type Variables } from '../context.js';

const app = new Hono<{ Variables: Variables }>();

// Aggregate stats for the caller's org: totals, breakdowns, recent activity, top tags.
app.get('/', async (c) => {
  const auth = c.get('auth');
  const sql = getEngine().client.sql;
  const org = auth.orgId;

  const [totals, byConnector, byStatus, activity, topTags] = await Promise.all([
    sql<{ documents: number; chunks: number; spaces: number; connections: number }[]>`
      SELECT
        (SELECT count(*)::int FROM documents WHERE org_id = ${org}) AS documents,
        (SELECT count(*)::int FROM chunks WHERE org_id = ${org}) AS chunks,
        (SELECT count(*)::int FROM spaces WHERE org_id = ${org}) AS spaces,
        (SELECT count(*)::int FROM connections WHERE org_id = ${org}) AS connections
    `,
    sql<{ connector: string; count: number }[]>`
      SELECT connector, count(*)::int AS count FROM documents WHERE org_id = ${org}
      GROUP BY connector ORDER BY count DESC
    `,
    sql<{ status: string; count: number }[]>`
      SELECT status::text AS status, count(*)::int AS count FROM documents WHERE org_id = ${org}
      GROUP BY status
    `,
    sql<{ day: string; count: number }[]>`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS count
      FROM documents
      WHERE org_id = ${org} AND created_at > now() - interval '14 days'
      GROUP BY day ORDER BY day
    `,
    sql<{ tag: string; count: number }[]>`
      SELECT tag, count(*)::int AS count
      FROM documents d, jsonb_array_elements_text(d.tags) AS tag
      WHERE d.org_id = ${org}
      GROUP BY tag ORDER BY count DESC LIMIT 15
    `,
  ]);

  return c.json({
    totals: totals[0] ?? { documents: 0, chunks: 0, spaces: 0, connections: 0 },
    byConnector,
    byStatus,
    activity,
    topTags,
  });
});

export default app;
