import { Hono } from 'hono';
import { z } from 'zod';
import { setCookie, deleteCookie } from 'hono/cookie';
import { and, eq } from 'drizzle-orm';
import { organizations, users, spaces } from '@companybrain/db';
import { getEngine, type Variables } from '../context.js';
import { hashPassword, verifyPassword, slugify } from '../crypto.js';
import { signSession, resolveAuth, SESSION_COOKIE } from '../auth.js';

const app = new Hono<{ Variables: Variables }>();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  orgName: z.string().min(1).optional(),
});

// Create an organization and its first owner user.
app.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const engine = getEngine();

  const existing = await engine.db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
  if (existing.length > 0) return c.json({ error: 'email_taken' }, 409);

  const orgName = d.orgName ?? `${d.name ?? d.email.split('@')[0]}'s workspace`;
  const [org] = await engine.db
    .insert(organizations)
    .values({ name: orgName, slug: `${slugify(orgName)}-${Date.now().toString(36)}` })
    .returning();
  const [user] = await engine.db
    .insert(users)
    .values({ orgId: org!.id, email: d.email, name: d.name, role: 'owner', passwordHash: hashPassword(d.password) })
    .returning();
  await engine.db
    .insert(spaces)
    .values({ orgId: org!.id, name: 'General', slug: 'general', isDefault: true, icon: 'brain' });

  const token = await signSession(user!.id, org!.id);
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return c.json({ token, user: publicUser(user!), org: { id: org!.id, name: org!.name } }, 201);
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

app.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const { email, password } = parsed.data;
  const engine = getEngine();
  const [user] = await engine.db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }
  void engine.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  const token = await signSession(user.id, user.orgId);
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return c.json({ token, user: publicUser(user) });
});

app.post('/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

app.get('/me', async (c) => {
  const auth = await resolveAuth(c);
  if (!auth) return c.json({ error: 'unauthorized' }, 401);
  const engine = getEngine();
  const [org] = await engine.db.select().from(organizations).where(eq(organizations.id, auth.orgId)).limit(1);
  let user = null;
  if (auth.userId) {
    const [u] = await engine.db
      .select()
      .from(users)
      .where(and(eq(users.id, auth.userId), eq(users.orgId, auth.orgId)))
      .limit(1);
    user = u ? publicUser(u) : null;
  }
  return c.json({ org: org ? { id: org.id, name: org.name, slug: org.slug } : null, user, via: auth.via });
});

function publicUser(u: typeof users.$inferSelect) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, avatarUrl: u.avatarUrl };
}

export default app;
