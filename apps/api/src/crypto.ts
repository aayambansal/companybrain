import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

/** Marker on a stored credentials blob that has been encrypted. */
const ENC_MARKER = '__cb_enc__';

/**
 * The 32-byte AES key derived from CREDENTIALS_KEY, or null when encryption is
 * off. Read at call time (not module load) so tests and runtime can set it.
 */
function credentialsKey(): Buffer | null {
  const raw = process.env.CREDENTIALS_KEY;
  if (!raw) return null;
  return createHash('sha256').update(raw).digest();
}

/**
 * Encrypt a connector credentials object for storage (AES-256-GCM). Strictly
 * opt-in: with no CREDENTIALS_KEY set, the object is returned unchanged, so
 * existing plaintext deployments are unaffected.
 */
export function encryptCredentials(creds: Record<string, unknown>): Record<string, unknown> {
  const key = credentialsKey();
  if (!key) return creds ?? {};
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(creds ?? {}), 'utf8'), cipher.final()]);
  return {
    [ENC_MARKER]: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: ct.toString('base64'),
  };
}

/**
 * Decrypt a stored credentials object. A plaintext object (no marker) is
 * returned as-is, so pre-encryption rows and no-key deployments keep working.
 * A blob that can't be decrypted (missing or wrong key, tampering) fails closed
 * to an empty object rather than throwing.
 */
export function decryptCredentials(stored: Record<string, unknown>): Record<string, unknown> {
  if (!stored || stored[ENC_MARKER] !== 1) return stored ?? {};
  const key = credentialsKey();
  if (!key) return {};
  try {
    const iv = Buffer.from(String(stored.iv), 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(Buffer.from(String(stored.tag), 'base64'));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(String(stored.data), 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(pt.toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

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

/** Prefix on a single encrypted secret string. */
const SECRET_PREFIX = 'enc:v1:';

/**
 * Encrypt one secret string (e.g. a provider API key) for storage in a settings
 * blob. Idempotent and opt-in: an already-encrypted value, an empty value, or a
 * deployment with no CREDENTIALS_KEY is returned unchanged, so it is safe to run
 * over a value carried forward from a previous save.
 */
export function encryptSecret(value: string): string {
  const key = credentialsKey();
  if (!key || !value || value.startsWith(SECRET_PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return SECRET_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

/**
 * Decrypt a secret produced by encryptSecret. A plaintext value (no prefix) is
 * returned as-is; an undecryptable one falls back to an empty string.
 */
export function decryptSecret(value: string): string {
  if (!value || !value.startsWith(SECRET_PREFIX)) return value ?? '';
  const key = credentialsKey();
  if (!key) return '';
  try {
    const raw = Buffer.from(value.slice(SECRET_PREFIX.length), 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'untitled'
  );
}
