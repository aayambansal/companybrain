import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  walkFiles,
  resolveExtensions,
  fileToSourceDocument,
  DEFAULT_FILE_EXTENSIONS,
} from './files.js';

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'cb-files-'));
  mkdirSync(join(root, 'sub'));
  mkdirSync(join(root, '.hidden'));
  writeFileSync(join(root, 'a.md'), '# A\nAlpha content.');
  writeFileSync(join(root, 'b.txt'), 'Bravo content.');
  writeFileSync(join(root, 'c.log'), 'ignore me');
  writeFileSync(join(root, 'sub', 'nested.md'), 'Nested content.');
  writeFileSync(join(root, '.hidden', 'secret.md'), 'secret');
  writeFileSync(join(root, '.dotfile.md'), 'dotfile');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('walkFiles', () => {
  it('walks recursively and returns sorted relative POSIX paths', () => {
    expect(walkFiles(root)).toEqual(['a.md', 'b.txt', 'c.log', 'sub/nested.md']);
  });

  it('skips dotfiles and dot-directories', () => {
    const files = walkFiles(root);
    expect(files).not.toContain('.dotfile.md');
    expect(files.some((f) => f.includes('.hidden'))).toBe(false);
  });

  it('filters by extension (with or without leading dot)', () => {
    expect(walkFiles(root, ['md'])).toEqual(['a.md', 'sub/nested.md']);
    expect(walkFiles(root, ['.md', 'txt'])).toEqual(['a.md', 'b.txt', 'sub/nested.md']);
  });
});

describe('fileToSourceDocument', () => {
  it('marks markdown files and derives a title from the filename', () => {
    const doc = fileToSourceDocument(root, 'a.md');
    expect(doc.sourceId).toBe('a.md');
    expect(doc.sourceType).toBe('markdown');
    expect(doc.title).toBe('a');
    expect(doc.content).toContain('Alpha content.');
    expect(doc.sourceUpdatedAt).toBeInstanceOf(Date);
  });

  it('marks non-markdown files as text', () => {
    expect(fileToSourceDocument(root, 'b.txt').sourceType).toBe('text');
  });
});

describe('resolveExtensions', () => {
  it('parses a CSV string', () => {
    expect(resolveExtensions('md, txt')).toEqual(['md', 'txt']);
  });

  it('accepts an array', () => {
    expect(resolveExtensions(['md', 'mdx'])).toEqual(['md', 'mdx']);
  });

  it('falls back to defaults for empty or missing values', () => {
    expect(resolveExtensions(undefined)).toEqual(DEFAULT_FILE_EXTENSIONS);
    expect(resolveExtensions('')).toEqual(DEFAULT_FILE_EXTENSIONS);
    expect(resolveExtensions([])).toEqual(DEFAULT_FILE_EXTENSIONS);
  });
});
