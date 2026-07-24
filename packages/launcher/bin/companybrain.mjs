#!/usr/bin/env node
/**
 * companybrain — one-command installer and runner for CompanyBrain.
 *
 *   npx companybrain            # set up and start the whole stack (Docker)
 *   npx companybrain up         # same
 *   npx companybrain dev        # run without Docker against a local Postgres
 *   npx companybrain down       # stop it
 *   npx companybrain upgrade    # pull latest, rebuild, restart
 *   npx companybrain uninstall  # remove containers, volumes, and the install
 *   npx companybrain logs       # tail logs
 *   npx companybrain status     # health check
 *   npx companybrain mcp        # print an MCP client config snippet
 *
 * Zero dependencies. Clones the repo if needed, writes a .env, and runs either
 * the bundled docker compose stack or, with `dev`, a local no-Docker stack.
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';
import { createInterface } from 'node:readline/promises';
import { randomBytes } from 'node:crypto';

const REPO = 'https://github.com/aayambansal/companybrain.git';
const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  amber: '\x1b[38;5;214m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
};
const paint = (c, s) => `${c}${s}${C.reset}`;

function banner() {
  process.stdout.write(
    paint(
      C.amber,
      `
       _---~~(~~-_.        companybrain
     _{        )   )       the open-source memory layer for your company
   ,   ) -~~- ( ,-' )_
  (  \`-,_..\`., )-- '_,)    self-hosted · bring your own keys · one command
 ( \` _)  (  -~( -_ \`,  }
 (_-  _  ~_-~~~~\`,  ,' )
   \`~ -^(    __;-,((()))
`,
    ) + '\n',
  );
}

function log(s) {
  process.stdout.write(s + '\n');
}
function die(s) {
  process.stderr.write(paint(C.red, 'error: ') + s + '\n');
  process.exit(1);
}

function has(cmd) {
  const r = spawnSync(
    process.platform === 'win32' ? 'where' : 'command',
    process.platform === 'win32' ? [cmd] : ['-v', cmd],
    { stdio: 'ignore', shell: process.platform !== 'win32' },
  );
  return r.status === 0;
}

function dockerReady() {
  if (!has('docker')) return false;
  const info = spawnSync('docker', ['info'], { stdio: 'ignore' });
  return info.status === 0;
}

/**
 * Ensure the Docker daemon is reachable. If Docker is installed but not running
 * (the common case on a fresh machine where Docker Desktop hasn't been opened),
 * start it and wait, rather than making the user stop, launch Docker, and re-run.
 */
async function ensureDockerRunning() {
  if (dockerReady()) return true;
  if (!has('docker')) return false; // not installed at all
  const launched =
    process.platform === 'darwin'
      ? spawnSync('open', ['-a', 'Docker'], { stdio: 'ignore' }).status === 0
      : process.platform === 'win32'
        ? spawnSync('cmd', ['/c', 'start', '', 'Docker Desktop'], { stdio: 'ignore' }).status === 0
        : false; // Linux daemons usually need `sudo systemctl start docker`, which we can't do unattended
  if (!launched) return dockerReady();
  process.stdout.write(paint(C.dim, 'Docker is installed but not running — starting it'));
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (dockerReady()) {
      process.stdout.write('\n');
      return true;
    }
    process.stdout.write(paint(C.dim, '.'));
    await new Promise((r) => setTimeout(r, 3000));
  }
  process.stdout.write('\n');
  return dockerReady();
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
    const a = (
      await rl.question(paint(C.amber, '? ') + q + (def ? paint(C.gray, ` (${def})`) : '') + ' ')
    ).trim();
    return a || def || '';
  };
  log('');
  const embedding = (await ask('Embeddings: local (no key) or openai?', 'local'))
    .toLowerCase()
    .startsWith('o')
    ? 'openai'
    : 'local';
  let openaiKey = '';
  if (embedding === 'openai') openaiKey = await ask('OpenAI API key (for embeddings)', '');
  const wantLlm = (
    await ask('Enable chat with an LLM key? (anthropic/openai/none)', 'none')
  ).toLowerCase();
  let anthropicKey = '';
  if (wantLlm.startsWith('a')) anthropicKey = await ask('Anthropic API key', '');
  if (wantLlm.startsWith('o') && !openaiKey) openaiKey = await ask('OpenAI API key', '');
  rl.close();
  return {
    embedding,
    openaiKey,
    anthropicKey,
    llm: wantLlm.startsWith('a') ? 'anthropic' : wantLlm.startsWith('o') ? 'openai' : 'none',
  };
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
      if (r.ok) {
        process.stdout.write('\n');
        return true;
      }
    } catch {
      /* not yet */
    }
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
  // Only prompt and write .env on first run; a re-run keeps the user's existing
  // config (and a stable JWT_SECRET) instead of clobbering hand-edited values.
  if (existsSync(join(dir, '.env'))) {
    log(
      paint(C.dim, `Using existing config at ${join(dir, '.env')} (edit it to change settings).`),
    );
  } else {
    const ans = await prompt(flags);
    writeEnv(dir, ans);
  }
  if (!(await ensureDockerRunning())) {
    die(
      has('docker')
        ? 'Docker is installed but did not become ready. Open Docker Desktop and wait for it to\n' +
            '  finish starting, then re-run `npx companybrain up`. If Docker Desktop keeps crashing,\n' +
            '  restart it, or reset it (Settings > Troubleshoot > Reset to factory defaults) / reinstall.\n' +
            '  Or skip Docker entirely: `npx companybrain dev` (runs against a local Postgres).\n' +
            `  App directory: ${dir}`
        : 'Docker is required and was not found. Install Docker Desktop\n' +
            '  (https://docs.docker.com/get-docker/), then re-run `npx companybrain up`.\n' +
            `  Or bring your own Postgres+pgvector: set DATABASE_URL in ${join(dir, '.env')},\n` +
            `  then run \`pnpm install && pnpm db:migrate && pnpm dev\` in ${dir}.`,
    );
  }
  log(paint(C.dim, 'Starting the stack (this builds images on first run) ...\n'));
  const code = await runStream('docker', ['compose', 'up', '-d', '--build'], { cwd: dir });
  if (code !== 0) die('docker compose failed.');
  const ok = await waitHealth('http://localhost:3333');
  log('');
  log(
    paint(
      C.green,
      ok
        ? '  CompanyBrain is up.'
        : '  Stack started (health check timed out; it may still be warming up).',
    ),
  );
  log('');
  log('  Dashboard   ' + paint(C.amber, 'http://localhost:3000'));
  log(
    '  API         ' + paint(C.amber, 'http://localhost:3333') + paint(C.gray, '  (docs at /docs)'),
  );
  log('');
  log(paint(C.dim, '  No sign-in required (single-user mode). Add memories from the dashboard,'));
  log(
    paint(
      C.dim,
      '  or connect a source under Connections. Manage keys under Settings > Providers.',
    ),
  );
  log('');
  log(paint(C.gray, '  Open it:   npx companybrain open       Update:  npx companybrain upgrade'));
  log(paint(C.gray, `  Stop it:   npx companybrain down       (app dir: ${dir})`));
  if (!flags['no-mcp']) {
    log('');
    log(
      paint(
        C.bold,
        '  Wire it into an AI agent (Claude Desktop / Cursor) — add to the MCP config:',
      ),
    );
    log(
      mcpSnippet()
        .split('\n')
        .map((l) => '    ' + l)
        .join('\n'),
    );
  }
  log('');
}

function requireInstall(dir) {
  if (!existsSync(join(dir, 'docker-compose.yml')))
    die(`No CompanyBrain install found at ${dir}. Run \`npx companybrain up\` first.`);
}

/** Parse a .env file into a plain object (ignores comments and blank lines). */
function envFileVars(dir) {
  const path = join(dir, '.env');
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** Best-effort TCP reachability check (zero-dependency, no pg client needed). */
function tcpReachable(host, port, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port });
    const finish = (ok) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
  });
}

async function pgReachable(dbUrl) {
  try {
    const u = new URL(dbUrl);
    return await tcpReachable(u.hostname || '127.0.0.1', Number(u.port || 5432));
  } catch {
    return false;
  }
}

/** Run a command in the foreground with the app's .env merged into the environment. */
function runWithEnv(dir, cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, {
      cwd: dir,
      stdio: 'inherit',
      env: { ...process.env, ...envFileVars(dir) },
    });
    p.on('close', (code) => resolve(code ?? 1));
  });
}

/**
 * Run the stack without Docker, against a local Postgres. For machines where
 * Docker isn't available or won't start. Installs deps, migrates, and runs the
 * API + dashboard in the foreground (Ctrl-C to stop).
 */
async function dev(flags) {
  banner();
  const dir = appDir(flags);
  ensureRepo(dir);
  if (!existsSync(join(dir, '.env'))) {
    const ans = await prompt(flags);
    writeEnv(dir, ans);
  }
  const env = envFileVars(dir);
  let dbUrl = flags.db ? String(flags.db) : env.DATABASE_URL;
  if (!dbUrl) {
    dbUrl = `postgres://${process.env.USER || 'postgres'}@127.0.0.1:5432/companybrain`;
    appendFileSync(join(dir, '.env'), `DATABASE_URL=${dbUrl}\nAUTO_MIGRATE=true\n`);
    log(paint(C.dim, `Using local Postgres: ${dbUrl}`));
  }
  if (!(await pgReachable(dbUrl))) {
    die(
      `Cannot reach Postgres at ${dbUrl}.\n` +
        '  Start it and create the database with the vector extension, e.g. on macOS:\n' +
        '    brew services start postgresql@14\n' +
        '    createdb companybrain && psql -d companybrain -c "CREATE EXTENSION vector"\n' +
        '  then re-run `npx companybrain dev`. (Or fix Docker and use `npx companybrain up`.)',
    );
  }
  if (!has('pnpm'))
    die('pnpm is required for the no-Docker path. Install it with `npm i -g pnpm`.');
  if (!existsSync(join(dir, 'node_modules'))) {
    log(paint(C.dim, 'Installing dependencies (first run, a few minutes) ...'));
    if ((await runStream('pnpm', ['install'], { cwd: dir })) !== 0) die('pnpm install failed.');
  }
  log(paint(C.dim, 'Running database migrations ...'));
  await runWithEnv(dir, 'pnpm', ['--filter', '@companybrain/db', 'migrate']);
  log('');
  log(paint(C.green, '  Starting CompanyBrain without Docker. Press Ctrl-C to stop.'));
  log('  Dashboard   ' + paint(C.amber, 'http://localhost:3000'));
  log(
    '  API         ' + paint(C.amber, 'http://localhost:3333') + paint(C.gray, '  (docs at /docs)'),
  );
  log('');
  // Run only the API + dashboard (not every package's dev task), in the
  // foreground, until the user presses Ctrl-C.
  await runWithEnv(dir, 'pnpm', [
    'exec',
    'turbo',
    'run',
    'dev',
    '--filter=@companybrain/api',
    '--filter=@companybrain/web',
  ]);
}

function openUrl(url) {
  if (process.platform === 'darwin') spawnSync('open', [url], { stdio: 'ignore' });
  else if (process.platform === 'win32')
    spawnSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' });
  else spawnSync('xdg-open', [url], { stdio: 'ignore' });
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(question)).trim().toLowerCase();
  rl.close();
  return answer === 'y' || answer === 'yes';
}

async function upgrade(flags) {
  const dir = appDir(flags);
  requireInstall(dir);
  if (!has('git')) die('git is required to upgrade, or update your checkout manually.');
  log(paint(C.dim, 'Fetching the latest CompanyBrain ...'));
  const pull = spawnSync('git', ['-C', dir, 'pull', '--ff-only'], { stdio: 'inherit' });
  if (pull.status !== 0)
    die(
      'git pull failed. If you edited files in the app directory, stash or discard them, then retry.',
    );
  if (!(await ensureDockerRunning())) die('Docker is not available; start Docker and retry.');
  log(paint(C.dim, 'Rebuilding and restarting ...\n'));
  const code = await runStream('docker', ['compose', 'up', '-d', '--build'], { cwd: dir });
  if (code !== 0) die('docker compose failed.');
  const ok = await waitHealth('http://localhost:3333');
  log(paint(C.green, ok ? '\n  Upgraded and running.' : '\n  Upgraded (still warming up).'));
  log('  Dashboard   ' + paint(C.amber, 'http://localhost:3000') + '\n');
}

async function uninstall(flags) {
  const dir = appDir(flags);
  if (!existsSync(join(dir, 'docker-compose.yml'))) die(`No CompanyBrain install found at ${dir}.`);
  if (!(flags.yes || flags.y)) {
    const ok = await confirm(
      paint(
        C.red,
        'This removes the containers, volumes (your stored memories), and install. Continue? (y/N) ',
      ),
    );
    if (!ok) return log('Cancelled.');
  }
  if (dockerReady()) {
    log(paint(C.dim, 'Stopping and removing containers + volumes ...'));
    await runStream('docker', ['compose', 'down', '-v', '--remove-orphans'], { cwd: dir });
  } else {
    log(paint(C.dim, 'Docker is not running, so containers/volumes were left as-is.'));
  }
  // Only delete the managed clone (~/.companybrain/app); never a user's own checkout.
  const managed = join(homedir(), '.companybrain', 'app');
  if (dir === managed) {
    log(paint(C.dim, `Removing ${dir} ...`));
    rmSync(dir, { recursive: true, force: true });
    log(paint(C.green, 'Uninstalled.'));
  } else {
    log(paint(C.green, 'Removed containers and volumes.'));
    log(paint(C.dim, `Left your checkout at ${dir} in place; delete it yourself if you want.`));
  }
}

async function main() {
  const { cmd, flags } = parseArgs(process.argv.slice(2));
  const dir = appDir(flags);
  switch (cmd) {
    case 'up':
    case 'start':
      return up(flags);
    case 'dev':
    case 'nodocker':
      return dev(flags);
    case 'down':
    case 'stop':
      requireInstall(dir);
      process.exit(await runStream('docker', ['compose', 'down'], { cwd: dir }));
      break;
    case 'restart':
      requireInstall(dir);
      if (!(await ensureDockerRunning())) die('Docker is not available; start Docker and retry.');
      log(paint(C.dim, 'Restarting the stack ...'));
      process.exit(await runStream('docker', ['compose', 'restart'], { cwd: dir }));
      break;
    case 'upgrade':
    case 'update':
      return upgrade(flags);
    case 'uninstall':
    case 'remove':
      return uninstall(flags);
    case 'open':
      openUrl('http://localhost:3000');
      log('Opening ' + paint(C.amber, 'http://localhost:3000'));
      break;
    case 'logs':
      requireInstall(dir);
      process.exit(await runStream('docker', ['compose', 'logs', '-f'], { cwd: dir }));
      break;
    case 'status': {
      try {
        const r = await fetch('http://localhost:3333/health', {
          signal: AbortSignal.timeout(3000),
        });
        const j = await r.json().catch(() => ({}));
        // /health returns 503 when the database is unreachable, so reflect the
        // status code rather than reporting "up" for a degraded instance.
        if (r.ok) log(paint(C.green, 'up') + ' ' + JSON.stringify(j));
        else log(paint(C.red, 'degraded') + ' ' + JSON.stringify(j));
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
      log('  up         set up (clone if needed) and start the stack   [default]');
      log('  dev        run without Docker against a local Postgres (Ctrl-C to stop)');
      log('  down       stop the stack');
      log('  restart    restart the stack');
      log('  upgrade    pull the latest version, rebuild, and restart');
      log('  open       open the dashboard in your browser');
      log('  logs       tail the stack logs');
      log('  status     check the API health');
      log('  mcp        print an MCP client config snippet');
      log('  uninstall  stop, remove containers + volumes, and the install');
      log('  help       this message\n');
      log('Flags: --yes (accept defaults / skip confirms), --dir=<path>, --no-mcp\n');
      break;
    default:
      die(`Unknown command "${cmd}". Try: npx companybrain help`);
  }
}

main().catch((e) => die(String(e?.message ?? e)));
