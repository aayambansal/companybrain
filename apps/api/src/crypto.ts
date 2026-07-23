import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** Hash an API key for storage. Keys are high-entropy, so a fast hash is fine. */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Generate a new API key: returns the plaintext (shown once) and storage fields. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const secret = randomBytes(24).toString('base64url');
  const rand = randomBytes(4).toString('hex');
  const prefix = `cb_${rand}`;
  const key = `${prefix}_${secret}`;
  return { key, prefix, hash: hashApiKey(key) };
}

/** Password hashing with scrypt (built-in, no native deps). Format: scrypt$salt$hash. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hash] = parts;
  const derived = scryptSync(password, salt!, 64);
  const expected = Buffer.from(hash!, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'untitled';
}
