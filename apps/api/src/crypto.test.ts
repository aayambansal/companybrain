import { describe, it, expect } from 'vitest';
import { hashApiKey, generateApiKey, hashPassword, verifyPassword, slugify } from './crypto.js';

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
