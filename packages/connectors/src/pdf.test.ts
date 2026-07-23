import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extractPdfText } from './pdf.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('extractPdfText', () => {
  it('extracts text from a real PDF (no canvas dependency)', async () => {
    const buf = readFileSync(join(here, '__fixtures__', 'sample.pdf'));
    const text = await extractPdfText(new Uint8Array(buf));
    expect(text).toContain('CompanyBrain');
    expect(text.toLowerCase()).toContain('thursday');
  });
});
