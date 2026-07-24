import { describe, it, expect } from 'vitest';
import { afterEach } from 'vitest';
import {
  hashApiKey,
  generateApiKey,
  hashPassword,
  verifyPassword,
  slugify,
  encryptCredentials,
  decryptCredentials,
  encryptSecret,
  decryptSecret,
} from './crypto.js';

describe('api keys', () => {
  it('generates a cb_-prefixed key whose hash matches', () => {
    const { key, prefix, hash } = generateApiKey();
    expect(key.startsWith('cb_')).toBe(true);
    expect(key.startsWith(prefix)).toBe(true);
    expect(hash).toBe(hashApiKey(key));
    expect(hash).toHaveLength(64);
  });

  it('produces unique keys', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).not.toBe(b.key);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('passwords', () => {
  it('verifies a correct password and rejects a wrong one', () => {
    const stored = hashPassword('correct horse battery staple');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('correct horse battery staple', stored)).toBe(true);
    expect(verifyPassword('wrong', stored)).toBe(false);
  });

  it('salts: same password hashes differently each time', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });

  it('rejects malformed stored values', () => {
    expect(verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(verifyPassword('x', 'scrypt$onlyonepart')).toBe(false);
  });
});

describe('slugify', () => {
  it('lowercases and dashes', () => {
    expect(slugify('Engineering Team!')).toBe('engineering-team');
  });
  it('falls back to untitled', () => {
    expect(slugify('   ')).toBe('untitled');
    expect(slugify('!!!')).toBe('untitled');
  });
});

describe('credential encryption', () => {
  const prev = process.env.CREDENTIALS_KEY;
  afterEach(() => {
    if (prev === undefined) delete process.env.CREDENTIALS_KEY;
    else process.env.CREDENTIALS_KEY = prev;
  });

  it('is a no-op when no key is configured (opt-in, backward compatible)', () => {
    delete process.env.CREDENTIALS_KEY;
    const creds = { token: 'abc', extra: 1 };
    expect(encryptCredentials(creds)).toBe(creds); // returned unchanged
    expect(decryptCredentials(creds)).toEqual(creds); // plaintext read as-is
  });

  it('round-trips through encrypt/decrypt when a key is set', () => {
    process.env.CREDENTIALS_KEY = 'unit-test-key';
    const creds = { token: 'secret-token', botToken: 'x', nested: { a: 1 } };
    const enc = encryptCredentials(creds);
    expect(enc.token).toBeUndefined(); // no plaintext left in the blob
    expect(enc.__cb_enc__).toBe(1);
    expect(decryptCredentials(enc)).toEqual(creds);
  });

  it('reads legacy plaintext rows even with a key set', () => {
    process.env.CREDENTIALS_KEY = 'unit-test-key';
    const plain = { token: 'legacy' };
    expect(decryptCredentials(plain)).toEqual(plain);
  });

  it('fails closed to {} when the key is wrong (no crash)', () => {
    process.env.CREDENTIALS_KEY = 'key-one';
    const enc = encryptCredentials({ token: 'abc' });
    process.env.CREDENTIALS_KEY = 'key-two';
    expect(decryptCredentials(enc)).toEqual({});
  });
});

describe('secret string encryption', () => {
  const prev = process.env.CREDENTIALS_KEY;
  afterEach(() => {
    if (prev === undefined) delete process.env.CREDENTIALS_KEY;
    else process.env.CREDENTIALS_KEY = prev;
  });

  it('is a no-op with no key configured', () => {
    delete process.env.CREDENTIALS_KEY;
    expect(encryptSecret('sk-abc123')).toBe('sk-abc123');
    expect(decryptSecret('sk-abc123')).toBe('sk-abc123');
  });

  it('round-trips and leaves no plaintext', () => {
    process.env.CREDENTIALS_KEY = 'unit-test-key';
    const enc = encryptSecret('sk-openai-secret');
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(enc).not.toContain('sk-openai-secret');
    expect(decryptSecret(enc)).toBe('sk-openai-secret');
  });

  it('is idempotent: encrypting an already-encrypted value is a no-op', () => {
    process.env.CREDENTIALS_KEY = 'unit-test-key';
    const once = encryptSecret('sk-x');
    expect(encryptSecret(once)).toBe(once);
  });

  it('reads legacy plaintext, and empty stays empty', () => {
    process.env.CREDENTIALS_KEY = 'unit-test-key';
    expect(decryptSecret('legacy-plain-key')).toBe('legacy-plain-key');
    expect(encryptSecret('')).toBe('');
  });
});
