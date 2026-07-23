import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { CompanyBrain } from '@companybrain/sdk';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: pnpm --filter @companybrain/example-ingest-folder start <folder>');
  process.exit(1);
}

const cb = new CompanyBrain({
  apiUrl: process.env.COMPANYBRAIN_API_URL,
  apiKey: process.env.COMPANYBRAIN_API_KEY,
});

const files = readdirSync(dir).filter((name) => {
  const ext = extname(name).toLowerCase();
  return (ext === '.md' || ext === '.txt') && statSync(join(dir, name)).isFile();
});

if (files.length === 0) {
  console.error(`no .md or .txt files found in ${dir}`);
  process.exit(1);
}

let added = 0;
for (const file of files) {
  const content = readFileSync(join(dir, file), 'utf8');
  const format = extname(file).toLowerCase() === '.md' ? 'markdown' : 'text';
  try {
    const memory = await cb.memories.add({ title: basename(file), content, format });
    added += 1;
    console.log(`added ${file} -> ${memory.id}`);
  } catch (err) {
    console.error(`failed ${file}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`\ningested ${added}/${files.length} file(s) from ${dir}`);
