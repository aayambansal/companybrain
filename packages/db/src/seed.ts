/**
 * Seed a demo organization, default space, and an admin user + API key.
 * Idempotent-ish: safe to run once on a fresh database.
 *
 * Run with: `pnpm --filter @companybrain/db seed`
 */
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createDb } from './client.js';
import { organizations, spaces, users, apiKeys } from './schema.js';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Generate a display + hashable API key (`cb_<prefix>_<secret>`). */
function generateApiKey(): { key: string; prefix: string; hash: string } {
  const secret = randomBytes(24).toString('base64url');
  const prefix = randomBytes(4).toString('hex');
  const key = `cb_${prefix}_${secret}`;
  return { key, prefix: `cb_${prefix}`, hash: sha256(key) };
}

export async function seed(connectionString = process.env.DATABASE_URL): Promise<void> {
  if (!connectionString) throw new Error('DATABASE_URL is required to seed.');
  const { db, close } = createDb(connectionString);
  try {
    const [org] = await db
      .insert(organizations)
      .values({ name: 'Acme Inc', slug: 'acme' })
      .returning();
    if (!org) throw new Error('failed to create organization');

    const [space] = await db
      .insert(spaces)
      .values({
        orgId: org.id,
        name: 'General',
        slug: 'general',
        description: 'Default space for company knowledge.',
        isDefault: true,
        icon: 'brain',
      })
      .returning();

    // Demo password: "companybrain" (bcrypt-less placeholder hash for seed only).
    await db.insert(users).values({
      orgId: org.id,
      email: 'admin@acme.test',
      name: 'Acme Admin',
      role: 'owner',
      passwordHash: sha256('companybrain'),
    });

    const apiKey = generateApiKey();
    await db.insert(apiKeys).values({
      orgId: org.id,
      name: 'Seed key',
      keyHash: apiKey.hash,
      prefix: apiKey.prefix,
    });

    console.log('Seeded demo data:');
    console.log(`  org:      ${org.name} (${org.id})`);
    console.log(`  space:    ${space?.name} (${space?.id})`);
    console.log(`  user:     admin@acme.test / companybrain`);
    console.log(`  API key:  ${apiKey.key}`);
    console.log('  Note: save the API key now. It is not stored in plaintext.');
  } finally {
    await close();
  }
}

const entry = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (entry.endsWith('/seed.ts') || entry.endsWith('/seed.js')) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] failed:', err);
      process.exit(1);
    });
}
