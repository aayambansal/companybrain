#!/usr/bin/env node
/**
 * companybrain — one-command installer and runner for CompanyBrain.
 *
 *   npx companybrain            # set up and start the whole stack
 *   npx companybrain up         # same
 *   npx companybrain down       # stop it
 *   npx companybrain logs       # tail logs
 *   npx companybrain status     # health check
 *   npx companybrain mcp        # print an MCP client config snippet
 *
 * Zero dependencies. Clones the repo if needed, writes a .env, and runs the
 * bundled docker compose stack (Postgres + pgvector, API, dashboard).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { randomBytes } from 'node:crypto';

const REPO = 'https://github.com/aayambansal/companybrain.git';
const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  amber: '\x1b[38;5;214m', red: '\x1b[31m', green: '\x1b[32m', gray: '\x1b[90m',
};
const paint = (c, s) => `${c}${s}${C.reset}`;

function banner() {
  process.stdout.write(
    paint(C.amber,
`
       _---~~(~~-_.        companybrain
     _{        )   )       the open-source memory layer for your company
   ,   ) -~~- ( ,-' )_
  (  \`-,_..\`., )-- '_,)    self-hosted · bring your own keys · one command
 ( \` _)  (  -~( -_ \`,  }
 (_-  _  ~_-~~~~\`,  ,' )
   \`~ -^(    __;-,((()))
`) + '\n');
}

function log(s) { process.stdout.write(s + '\n'); }
function die(s) { process.stderr.write(paint(C.red, 'error: ') + s + '\n'); process.exit(1); }

function has(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'command', process.platform === 'win32' ? [cmd] : ['-v', cmd], { stdio: 'ignore', shell: process.platform !== 'win32' });
  return r.status === 0;
}

function dockerReady() {
  if (!has('docker')) return false;
  const info = spawnSync('docker', ['info'], { stdio: 'ignore' });
  return info.status === 0;
}

function runStream(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('close', (code) => resolve(code ?? 1));
  });
}

function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      flags[k] = v ?? true;
    } else if (a.startsWith('-')) {
      flags[a.slice(1)] = true;
    } else positionals.push(a);
  }
  return { cmd: positionals[0] ?? 'up', flags };
}

function appDir(flags) {
  if (flags.dir) return String(flags.dir);
  // If run from inside a checkout, use it.
  if (existsSync('docker-compose.yml') && existsSync('pnpm-workspace.yaml')) return process.cwd();
  return join(homedir(), '.companybrain', 'app');
}

function ensureRepo(dir) {
  if (existsSync(join(dir, 'docker-compose.yml'))) return;
  log(paint(C.dim, `Fetching CompanyBrain into ${dir} ...`));
  mkdirSync(dir, { recursive: true });
  if (!has('git')) die('git is required to fetch CompanyBrain, or run this from a checkout.');
  const r = spawnSync('git', ['clone', '--depth', '1', REPO, dir], { stdio: 'inherit' });
  if (r.status !== 0) die('git clone failed.');
}

async function prompt(flags) {
  if (flags.yes || flags.y) {
    return { embedding: 'local', openaiKey: '', anthropicKey: '' };
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q, def) => {
    const a = (await rl.question(paint(C.amber, '? ') + q + (def ? paint(C.gray, ` (${def})`) : '') + ' ')).trim();
    return a || def || '';
  };
  log('');
  const embedding = (await ask('Embeddings: local (no key) or openai?', 'local')).toLowerCase().startsWith('o') ? 'openai' : 'local';
  let openaiKey = '';
  if (embedding === 'openai') openaiKey = await ask('OpenAI API key (for embeddings)', '');
  const wantLlm = (await ask('Enable chat with an LLM key? (anthropic/openai/none)', 'none')).toLowerCase();
  let anthropicKey = '';
  if (wantLlm.startsWith('a')) anthropicKey = await ask('Anthropic API key', '');
  if (wantLlm.startsWith('o') && !openaiKey) openaiKey = await ask('OpenAI API key', '');
  rl.close();
  return { embedding, openaiKey, anthropicKey, llm: wantLlm.startsWith('a') ? 'anthropic' : wantLlm.startsWith('o') ? 'openai' : 'none' };
}

function writeEnv(dir, ans) {
  const secret = randomBytes(32).toString('hex');
  const lines = [
    '# Written by `npx companybrain`. Safe to edit.',
    'AUTH_MODE=single',
    `JWT_SECRET=${secret}`,
    `EMBEDDING_PROVIDER=${ans.embedding}`,
    `LLM_PROVIDER=${ans.llm ?? 'none'}`,
    ans.openaiKey ? `OPENAI_API_KEY=${ans.openaiKey}` : 'OPENAI_API_KEY=',
    ans.anthropicKey ? `ANTHROPIC_API_KEY=${ans.anthropicKey}` : 'ANTHROPIC_API_KEY=',
    'NEXT_PUBLIC_API_URL=http://localhost:3333',
    'CORS_ORIGINS=http://localhost:3000',
  ];
  writeFileSync(join(dir, '.env'), lines.join('\n') + '\n');
}

async function waitHealth(url, seconds = 90) {
  const deadline = Date.now() + seconds * 1000;
  process.stdout.write(paint(C.dim, 'Waiting for the API to come up'));
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url + '/health', { signal: AbortSignal.timeout(2000) });
      if (r.ok) { process.stdout.write('\n'); return true; }
    } catch { /* not yet */ }
    process.stdout.write(paint(C.dim, '.'));
    await new Promise((r) => setTimeout(r, 2000));
  }
  process.stdout.write('\n');
  return false;
}

function mcpSnippet() {
  return JSON.stringify(
    {
      mcpServers: {
        companybrain: {
          command: 'npx',
          args: ['-y', '@companybrain/mcp'],
          env: { COMPANYBRAIN_API_URL: 'http://localhost:3333' },
        },
      },
    },
    null,
    2,
  );
}

async function up(flags) {
  banner();
  const dir = appDir(flags);
  ensureRepo(dir);
  const ans = await prompt(flags);
  writeEnv(dir, ans);
  if (!dockerReady()) {
    die(
      'Docker is not running. Start Docker Desktop (or the daemon), then re-run `npx companybrain up`.\n' +
      `  App directory: ${dir}\n` +
      '  Alternatively run without Docker: `pnpm install && pnpm db:migrate && pnpm dev` in that directory.',
    );
  }
  log(paint(C.dim, 'Starting the stack (this builds images on first run) ...\n'));
  const code = await runStream('docker', ['compose', 'up', '-d', '--build'], { cwd: dir });
  if (code !== 0) die('docker compose failed.');
  const ok = await waitHealth('http://localhost:3333');
  log('');
  log(paint(C.green, ok ? '  CompanyBrain is up.' : '  Stack started (health check timed out; it may still be warming up).'));
  log('');
  log('  Dashboard   ' + paint(C.amber, 'http://localhost:3000'));
  log('  API         ' + paint(C.amber, 'http://localhost:3333') + paint(C.gray, '  (docs at /docs)'));
  log('');
  log(paint(C.dim, '  No sign-in required (single-user mode). Add memories from the dashboard,'));
  log(paint(C.dim, '  or connect a source under Connections. Manage keys under Settings > Providers.'));
  log('');
  log(paint(C.gray, `  Stop it with:  npx companybrain down        (app dir: ${dir})`));
  if (!flags['no-mcp']) {
    log('');
    log(paint(C.bold, '  Wire it into an AI agent (Claude Desktop / Cursor) — add to the MCP config:'));
    log(mcpSnippet().split('\n').map((l) => '    ' + l).join('\n'));
  }
  log('');
}

async function main() {
  const { cmd, flags } = parseArgs(process.argv.slice(2));
  const dir = appDir(flags);
  switch (cmd) {
    case 'up':
    case 'start':
      return up(flags);
    case 'down':
    case 'stop':
      if (!existsSync(join(dir, 'docker-compose.yml'))) die(`No CompanyBrain install found at ${dir}.`);
      process.exit(await runStream('docker', ['compose', 'down'], { cwd: dir }));
      break;
    case 'logs':
      process.exit(await runStream('docker', ['compose', 'logs', '-f'], { cwd: dir }));
      break;
    case 'status': {
      try {
        const r = await fetch('http://localhost:3333/health', { signal: AbortSignal.timeout(3000) });
        const j = await r.json();
        log(paint(C.green, 'up') + ' ' + JSON.stringify(j));
      } catch {
        log(paint(C.red, 'down') + ' (API not reachable on :3333)');
      }
      break;
    }
    case 'mcp':
      banner();
      log('Add this to your MCP client config (Claude Desktop / Cursor):\n');
      log(mcpSnippet());
      log('');
      break;
    case 'help':
    case '--help':
    case '-h':
      banner();
      log('Usage: npx companybrain <command>\n');
      log('  up        set up (clone if needed) and start the stack   [default]');
      log('  down      stop the stack');
      log('  logs      tail the stack logs');
      log('  status    check the API health');
      log('  mcp       print an MCP client config snippet');
      log('  help      this message\n');
      log('Flags: --yes (accept defaults), --dir=<path>, --no-mcp\n');
      break;
    default:
      die(`Unknown command "${cmd}". Try: npx companybrain help`);
  }
}

main().catch((e) => die(String(e?.message ?? e)));
