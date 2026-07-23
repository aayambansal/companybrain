#!/usr/bin/env node
import { createInterface } from 'node:readline';
import type { Citation, CompanyBrain, SearchMode } from '@companybrain/sdk';
import { configPath, resolveConfig, saveConfig } from './config.js';
import * as ui from './ui.js';

interface Args {
  command?: string;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

interface Source {
  index: number;
  title: string | null;
  sourceUrl: string | null;
  documentId: string;
}

// A small hand-rolled argv parser: first bare token is the command, `--k v`
// and `--k=v` are flags, lone `--k` is a boolean, everything else positional.
function parseArgs(argv: string[]): Args {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === '-h' || arg === '--help') {
      flags.help = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
        continue;
      }
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }
    if (command === undefined) command = arg;
    else positionals.push(arg);
  }

  return { command, positionals, flags };
}

function strFlag(args: Args, name: string): string | undefined {
  const v = args.flags[name];
  return typeof v === 'string' ? v : undefined;
}

function numFlag(args: Args, name: string): number | undefined {
  const v = args.flags[name];
  if (typeof v !== 'string') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function out(s: string): void {
  process.stdout.write(s + '\n');
}

function fail(message: string): never {
  process.stderr.write(ui.red('error: ') + message + '\n');
  process.exit(1);
}

function isApiError(e: unknown): e is { message: string; status?: number; name: string } {
  return e instanceof Error && e.name === 'CompanyBrainError';
}

async function getClient(): Promise<CompanyBrain> {
  const cfg = resolveConfig();
  const mod = await import('@companybrain/sdk');
  return new mod.CompanyBrain({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey });
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function cmdAdd(args: Args): Promise<void> {
  let text = args.positionals.join(' ').trim();
  const wantsStdin = text === '' || text === '-';
  if (wantsStdin) {
    if (process.stdin.isTTY) {
      fail('add: no text provided. Pass text as an argument or pipe it via stdin.');
    }
    text = (await readStdin()).trim();
  }
  if (!text) fail('add: empty input.');

  const tags = strFlag(args, 'tags')
    ?.split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const cb = await getClient();
  const memory = await cb.memories.add({
    content: text,
    title: strFlag(args, 'title'),
    space: strFlag(args, 'space'),
    tags,
    sourceUrl: strFlag(args, 'url'),
  });
  out(memory.id);
}

async function cmdSearch(args: Args): Promise<void> {
  const q = args.positionals.join(' ').trim();
  if (!q) fail('search: missing query.');

  const cb = await getClient();
  const { hits, tookMs, mode } = await cb.search({
    q,
    mode: strFlag(args, 'mode') as SearchMode | undefined,
    space: strFlag(args, 'space'),
    limit: numFlag(args, 'limit') ?? 10,
  });

  if (hits.length === 0) {
    out(ui.dim('No results.'));
    return;
  }

  for (const h of hits) {
    const score = h.score.toFixed(3);
    const title = h.document.title ?? 'Untitled';
    out(`${ui.green(score)}  ${ui.bold(title)}`);
    out(ui.dim(ui.snip(h.content, 200)));
    if (h.document.sourceUrl) out(ui.cyan(h.document.sourceUrl));
    out('');
  }
  process.stderr.write(ui.dim(`${hits.length} result(s) in ${tookMs}ms (${mode})`) + '\n');
}

function printSources(sources: Source[]): void {
  if (sources.length === 0) return;
  out('');
  out(ui.bold('Sources:'));
  for (const s of sources) {
    const label = s.title ?? s.documentId;
    const url = s.sourceUrl ? ' ' + ui.dim(s.sourceUrl) : '';
    out(`  ${ui.cyan(`[${s.index}]`)} ${label}${url}`);
  }
}

async function cmdAsk(args: Args): Promise<void> {
  const question = args.positionals.join(' ').trim();
  if (!question) fail('ask: missing question.');

  const cb = await getClient();
  const space = strFlag(args, 'space');

  if (process.stdout.isTTY) {
    let sources: Source[] = [];
    for await (const frame of cb.chatStream({ message: question, space })) {
      if (frame.event === 'token') {
        process.stdout.write(frame.data);
      } else if (frame.event === 'citations') {
        try {
          sources = JSON.parse(frame.data) as Source[];
        } catch {
          // Ignore malformed citation frames.
        }
      }
    }
    process.stdout.write('\n');
    printSources(sources);
    return;
  }

  const res = await cb.chat({ message: question, space });
  out(res.message);
  printSources(
    res.citations.map((c: Citation) => ({
      index: c.index,
      title: c.title,
      sourceUrl: c.sourceUrl,
      documentId: c.documentId,
    })),
  );
}

async function cmdSpaces(): Promise<void> {
  const cb = await getClient();
  const spaces = await cb.spaces.list();
  if (spaces.length === 0) {
    out(ui.dim('No spaces.'));
    return;
  }
  const width = Math.max(...spaces.map((s) => s.name.length));
  for (const s of spaces) {
    const count = s.documentCount ?? 0;
    const name = s.name.padEnd(width);
    const def = s.isDefault ? ui.dim(' (default)') : '';
    out(`${ui.bold(name)}  ${ui.green(String(count))} docs  ${ui.dim(s.slug)}${def}`);
  }
}

interface StatusShape {
  name?: string;
  version?: string;
  embedding?: { provider?: string; model?: string };
  llm?: { provider?: string; model?: string; available?: boolean };
  counts?: { documents?: number; chunks?: number; spaces?: number };
}

function field(label: string, value: string): void {
  out(`  ${ui.dim(label.padEnd(12))}${value}`);
}

async function cmdStatus(): Promise<void> {
  const cfg = resolveConfig();
  const cb = await getClient();
  const s = (await cb.status()) as StatusShape;

  out(ui.cyan(ui.brain()));
  out('');
  field('name', `${s.name ?? 'companybrain'}  ${ui.dim(`v${s.version ?? '?'}`)}`);
  field('api', cfg.apiUrl);
  if (s.embedding) {
    field('embeddings', `${s.embedding.provider ?? '?'} / ${s.embedding.model ?? '?'}`);
  }
  if (s.llm) {
    const state = s.llm.available ? ui.green('available') : ui.yellow('unavailable');
    field('llm', `${s.llm.provider ?? '?'} / ${s.llm.model ?? '?'}  ${state}`);
  }
  if (s.counts) {
    field('documents', String(s.counts.documents ?? 0));
    field('chunks', String(s.counts.chunks ?? 0));
    field('spaces', String(s.counts.spaces ?? 0));
  } else {
    out(ui.dim('  (set an API key to see org counts)'));
  }
}

function mask(key: string): string {
  if (key.length <= 8) return '********';
  return key.slice(0, 4) + '…' + key.slice(-4);
}

function cmdConfig(): void {
  const cfg = resolveConfig();
  out(ui.bold('CompanyBrain configuration'));
  field('api url', `${cfg.apiUrl}  ${ui.dim(`(${cfg.sources.apiUrl})`)}`);
  const key = cfg.apiKey
    ? `${ui.green('set')} ${ui.dim(mask(cfg.apiKey))}  ${ui.dim(`(${cfg.sources.apiKey})`)}`
    : `${ui.yellow('not set')}`;
  field('api key', key);
  field('config file', configPath());
  out('');
  out(ui.dim('precedence: env (COMPANYBRAIN_API_URL, COMPANYBRAIN_API_KEY)'));
  out(ui.dim('            > ~/.companybrain/config.json > defaults'));
}

async function cmdLogin(): Promise<void> {
  const current = resolveConfig();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const question = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

  try {
    const url = (await question(`API URL [${current.apiUrl}]: `)).trim() || current.apiUrl;
    const key = (await question('API key: ')).trim();
    const cfg: { apiUrl: string; apiKey?: string } = { apiUrl: url };
    if (key) cfg.apiKey = key;
    else if (current.apiKey && current.sources.apiKey === 'config file') cfg.apiKey = current.apiKey;
    const path = saveConfig(cfg);
    out(ui.green('Saved ') + path);
  } finally {
    rl.close();
  }
}

function printHelp(): void {
  out(ui.cyan(ui.brain()));
  out('');
  out(ui.bold('CompanyBrain') + ui.dim(' — the open-source memory layer'));
  out('');
  out('Usage: companybrain <command> [options]   (alias: cb)');
  out('');
  out(ui.bold('Commands'));
  out('  add <text>            Add a memory. Use `-` or pipe stdin to read from stdin.');
  out(ui.dim('    --title <t>  --space <s>  --tags <a,b>  --url <u>'));
  out('  search <query>        Search memories, ranked.');
  out(ui.dim('    --mode <hybrid|semantic|keyword>  --limit <n>  --space <s>'));
  out('  ask <question>        Ask a question; streams an answer with sources.');
  out(ui.dim('    --space <s>'));
  out('  spaces                List spaces with document counts.');
  out('  status                Show API status (providers, counts).');
  out('  config                Show resolved configuration.');
  out('  login                 Save API URL and key to ~/.companybrain/config.json.');
  out('  help                  Show this help.');
  out('');
  out(ui.dim('Config: env > ~/.companybrain/config.json > defaults.'));
  out(ui.dim('Env: COMPANYBRAIN_API_URL, COMPANYBRAIN_API_KEY.'));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === undefined || args.command === 'help' || args.flags.help) {
    printHelp();
    return;
  }

  switch (args.command) {
    case 'add':
      await cmdAdd(args);
      break;
    case 'search':
      await cmdSearch(args);
      break;
    case 'ask':
      await cmdAsk(args);
      break;
    case 'spaces':
      await cmdSpaces();
      break;
    case 'status':
      await cmdStatus();
      break;
    case 'config':
      cmdConfig();
      break;
    case 'login':
      await cmdLogin();
      break;
    default:
      process.stderr.write(ui.red(`Unknown command: ${args.command}`) + '\n');
      printHelp();
      process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  if (isApiError(err)) {
    const status = err.status ? ui.dim(` (${err.status})`) : '';
    process.stderr.write(ui.red('error: ') + err.message + status + '\n');
    if (err.status === 401) {
      process.stderr.write(ui.dim('hint: run `companybrain login` to set your API key.') + '\n');
    }
  } else {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(ui.red('error: ') + message + '\n');
  }
  process.exitCode = 1;
});
