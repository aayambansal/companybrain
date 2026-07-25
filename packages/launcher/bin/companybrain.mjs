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
// Colour is dropped when stdout is not a TTY (a pipe, a log file, CI) and when
// NO_COLOR is set, so captured output stays readable instead of filling with
// escape codes.
const COLOR =
  process.stdout.isTTY === true &&
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== 'dumb';
const paint = (c, s) => (COLOR ? `${c}${s}${C.reset}` : s);

function banner() {
  // Solid block letterforms under a vertical amber gradient. 71 columns, so it
  // still fits an 80-column terminal. Colour is dropped when stdout is not a
  // TTY so piped output stays readable.
  const rows = [
    [226, '█████ █████ █   █ █████ █████ █   █ █   █ ████  █████ █████ █████ █   █'],
    [220, '█     █   █ ██ ██ █   █ █   █ ██  █  █ █  █   █ █   █ █   █   █   ██  █'],
    [214, '█     █   █ █ █ █ █████ █████ █ █ █   █   ████  █████ █████   █   █ █ █'],
    [208, '█     █   █ █   █ █     █   █ █  ██   █   █   █ █  █  █   █   █   █  ██'],
    [172, '█████ █████ █   █ █     █   █ █   █   █   ████  █   █ █   █ █████ █   █'],
  ];
  const art = rows
    .map(([tone, row]) => (COLOR ? `  \x1b[38;5;${tone}m${row}\x1b[0m` : `  ${row}`))
    .join('\n');
  process.stdout.write(
    `\n${art}\n\n` +
      paint(C.gray, '  the open-source memory layer for your company') +
      '\n' +
      paint(C.gray, '  self-hosted · bring your own keys · one command') +
      '\n\n',
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

/** Where we remember that starting Docker failed, so we stop re-triggering it. */
function dockerFailFlag() {
  return join(homedir(), '.companybrain', 'docker-unavailable');
}

/** True if Docker failed to start recently (within a week). */
function dockerRecentlyFailed() {
  try {
    const at = Number(readFileSync(dockerFailFlag(), 'utf8').trim());
    return Number.isFinite(at) && Date.now() - at < 7 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function rememberDockerFailure(failed) {
  try {
    if (failed) {
      mkdirSync(join(homedir(), '.companybrain'), { recursive: true });
      writeFileSync(dockerFailFlag(), String(Date.now()));
    } else {
      rmSync(dockerFailFlag(), { force: true });
    }
  } catch {
    /* remembering is best effort */
  }
}

/**
 * Ensure the Docker daemon is reachable. If Docker is installed but not running
 * (the common case on a fresh machine where Docker Desktop hasn't been opened),
 * start it and wait, rather than making the user stop, launch Docker, and re-run.
 *
 * If a previous run already found Docker unable to start, don't launch it again:
 * on a broken install (Docker Desktop's privileged-helper repair is the common
 * one) that just pops its crash dialog on every single run. `--retry-docker`
 * forces another attempt once the user has fixed it.
 */
async function ensureDockerRunning(flags = {}) {
  if (dockerReady()) {
    rememberDockerFailure(false);
    return true;
  }
  if (!has('docker')) return false; // not installed at all
  if (dockerRecentlyFailed() && !flags['retry-docker']) {
    log(
      paint(
        C.dim,
        'Skipping Docker: it failed to start on a previous run (--retry-docker to try again).',
      ),
    );
    return false;
  }
  const launched =
    process.platform === 'darwin'
      ? spawnSync('open', ['-a', 'Docker'], { stdio: 'ignore' }).status === 0
      : process.platform === 'win32'
        ? spawnSync('cmd', ['/c', 'start', '', 'Docker Desktop'], { stdio: 'ignore' }).status === 0
        : false; // Linux daemons usually need `sudo systemctl start docker`, which we can't do unattended
  if (!launched) return dockerReady();
  process.stdout.write(paint(C.dim, 'Docker is installed but not running, starting it'));
  // 60s is plenty for a healthy Docker Desktop to expose its socket. A Docker
  // that is going to fail (a broken privileged-helper repair, for instance)
  // fails within seconds, and waiting longer just delays the fallback.
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (dockerReady()) {
      process.stdout.write('\n');
      return true;
    }
    // Docker Desktop quitting after its crash dialog means it will not recover
    // on this run; stop waiting out the full deadline.
    if (process.platform === 'darwin' && !dockerDesktopAlive()) break;
    process.stdout.write(paint(C.dim, '.'));
    await new Promise((r) => setTimeout(r, 3000));
  }
  process.stdout.write('\n');
  const ok = dockerReady();
  rememberDockerFailure(!ok);
  return ok;
}

/** True while a Docker Desktop process is still alive (macOS). */
function dockerDesktopAlive() {
  return spawnSync('pgrep', ['-f', 'Docker Desktop'], { stdio: 'ignore' }).status === 0;
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

/**
 * Model menus, kept in step with the provider options the API exposes at
 * /v1/providers so the terminal never offers something the server rejects.
 * The first entry of each list is the default.
 */
const EMBED_MODELS = {
  local: [['cb-hash-embed-v1', 'built in, no key, good for most notes']],
  openai: [
    ['text-embedding-3-small', 'fast and cheap'],
    ['text-embedding-3-large', 'most accurate'],
  ],
  google: [['text-embedding-004', "Gemini's embedding model"]],
  ollama: [
    ['nomic-embed-text', 'solid general purpose'],
    ['mxbai-embed-large', 'larger, more accurate'],
  ],
};
const CHAT_MODELS = {
  anthropic: [
    ['claude-sonnet-5', 'balanced speed and quality'],
    ['claude-opus-5', 'most capable'],
    ['claude-haiku-4-5-20251001', 'fastest and cheapest'],
  ],
  openai: [
    ['gpt-4o-mini', 'fast and cheap'],
    ['gpt-4o', 'most capable'],
  ],
  ollama: [
    ['llama3.1', 'good default'],
    ['qwen2.5', 'strong at reasoning'],
  ],
  none: [['none', 'answers are quoted straight from your memories']],
};

/** A numbered menu. Returns the chosen entry's key. Enter takes the default. */
async function select(rl, title, rows, { hint } = {}) {
  log('');
  log(paint(C.bold, '  ' + title));
  if (hint) log(paint(C.gray, '  ' + hint));
  log('');
  // Size the label column to the longest entry so a long model id never runs
  // into its description.
  const width = Math.max(...rows.map((r) => r.label.length)) + 2;
  rows.forEach((r, i) => {
    const n = paint(C.amber, String(i + 1).padStart(3));
    const name = r.note ? r.label.padEnd(width) : r.label;
    log(`${n}  ${name}${paint(C.gray, r.note ?? '')}`);
    if (r.sub) log(`     ${paint(C.gray, r.sub)}`);
  });
  log('');
  for (;;) {
    const raw = (
      await rl.question(paint(C.amber, '  > ') + paint(C.gray, `1-${rows.length} (1) `))
    ).trim();
    if (!raw) return rows[0].key;
    const n = Number.parseInt(raw, 10);
    if (Number.isInteger(n) && n >= 1 && n <= rows.length) return rows[n - 1].key;
    log(paint(C.red, `  Enter a number between 1 and ${rows.length}.`));
  }
}

/** Ask for an API key, re-prompting until it is non-empty. */
async function askKey(rl, label, url) {
  log('');
  log(paint(C.gray, `  Get one at ${url}`));
  for (;;) {
    const v = (await rl.question(paint(C.amber, `  ${label} `))).trim();
    if (v) return v;
    log(paint(C.red, '  That cannot be empty. Paste the key, or Ctrl-C to start over.'));
  }
}

/** Pick a model for a provider, showing what each one is good for. */
async function pickModel(rl, kind, provider, table) {
  const list = table[provider];
  if (!list || list.length <= 1) return list?.[0]?.[0] ?? '';
  return select(
    rl,
    `Which ${kind} model?`,
    list.map(([id, note]) => ({ key: id, label: id, note })),
  );
}

/**
 * First-run setup. One question at a time, each with a plain-language reason,
 * so the choice is obvious without knowing the provider matrix by heart.
 */
async function prompt(flags) {
  if (flags.yes || flags.y) {
    return {
      embedding: 'local',
      embeddingModel: 'cb-hash-embed-v1',
      llm: 'none',
      llmModel: 'none',
    };
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const choice = await select(
      rl,
      'How should CompanyBrain think?',
      [
        {
          key: 'local',
          label: 'Local only',
          note: 'no API key, works offline',
          sub: 'Search runs on a built-in embedder. Answers quote your memories directly.',
        },
        {
          key: 'anthropic',
          label: 'Anthropic Claude',
          note: 'needs an Anthropic key',
          sub: 'Claude writes the answers. Embeddings stay local, so search still needs no key.',
        },
        {
          key: 'openai',
          label: 'OpenAI',
          note: 'needs an OpenAI key',
          sub: 'One key covers both search embeddings and chat answers.',
        },
        {
          key: 'google',
          label: 'Google Gemini',
          note: 'needs a Google key',
          sub: 'Gemini handles embeddings. Gemini chat is not wired up yet, so answers stay local.',
        },
        {
          key: 'ollama',
          label: 'Ollama',
          note: 'needs Ollama running',
          sub: 'Everything runs on your own machine through an Ollama server.',
        },
        {
          key: 'custom',
          label: 'Mix providers',
          note: 'choose each separately',
          sub: 'Pick the embedding provider and the chat provider independently.',
        },
      ],
      { hint: 'Embeddings power search. A chat model turns what it finds into an answer.' },
    );

    const ans = {
      embedding: 'local',
      embeddingModel: 'cb-hash-embed-v1',
      llm: 'none',
      llmModel: 'none',
      openaiKey: '',
      anthropicKey: '',
      googleKey: '',
    };

    const needKey = async (provider) => {
      if (provider === 'openai' && !ans.openaiKey)
        ans.openaiKey = await askKey(rl, 'OpenAI API key', 'https://platform.openai.com/api-keys');
      if (provider === 'anthropic' && !ans.anthropicKey)
        ans.anthropicKey = await askKey(
          rl,
          'Anthropic API key',
          'https://console.anthropic.com/settings/keys',
        );
      if (provider === 'google' && !ans.googleKey)
        ans.googleKey = await askKey(
          rl,
          'Google API key',
          'https://aistudio.google.com/app/apikey',
        );
    };

    const setEmbedding = async (provider) => {
      ans.embedding = provider;
      await needKey(provider);
      ans.embeddingModel = await pickModel(rl, 'embedding', provider, EMBED_MODELS);
    };
    const setChat = async (provider) => {
      ans.llm = provider;
      if (provider === 'none') {
        ans.llmModel = 'none';
        return;
      }
      await needKey(provider);
      ans.llmModel = await pickModel(rl, 'chat', provider, CHAT_MODELS);
    };

    if (choice === 'local') {
      // defaults already describe this
    } else if (choice === 'anthropic') {
      await setChat('anthropic');
    } else if (choice === 'openai') {
      await setEmbedding('openai');
      await setChat('openai');
    } else if (choice === 'google') {
      await setEmbedding('google');
    } else if (choice === 'ollama') {
      await setEmbedding('ollama');
      await setChat('ollama');
    } else {
      await setEmbedding(
        await select(rl, 'Which provider should power search?', [
          { key: 'local', label: 'Local', note: 'no key' },
          { key: 'openai', label: 'OpenAI', note: 'needs a key' },
          { key: 'google', label: 'Google Gemini', note: 'needs a key' },
          { key: 'ollama', label: 'Ollama', note: 'local server' },
        ]),
      );
      await setChat(
        await select(rl, 'Which provider should write answers?', [
          { key: 'none', label: 'None', note: 'quote memories directly' },
          { key: 'anthropic', label: 'Anthropic Claude', note: 'needs a key' },
          { key: 'openai', label: 'OpenAI', note: 'needs a key' },
          { key: 'ollama', label: 'Ollama', note: 'local server' },
        ]),
      );
    }

    log('');
    log(paint(C.green, '  Ready'));
    log(`    search  ${paint(C.amber, ans.embedding)} ${paint(C.gray, ans.embeddingModel)}`);
    log(
      `    answers ${paint(C.amber, ans.llm)} ${paint(C.gray, ans.llm === 'none' ? 'extractive, no model' : ans.llmModel)}`,
    );
    log(paint(C.gray, '    Change any of this later in Settings, or by editing .env.'));
    return ans;
  } finally {
    rl.close();
  }
}

function writeEnv(dir, ans) {
  const secret = randomBytes(32).toString('hex');
  const lines = [
    '# Written by `npx companybrain`. Safe to edit.',
    'AUTH_MODE=single',
    `JWT_SECRET=${secret}`,
    `EMBEDDING_PROVIDER=${ans.embedding}`,
    `EMBEDDING_MODEL=${ans.embeddingModel ?? ''}`,
    `LLM_PROVIDER=${ans.llm ?? 'none'}`,
    `LLM_MODEL=${ans.llmModel ?? 'none'}`,
    `OPENAI_API_KEY=${ans.openaiKey ?? ''}`,
    `ANTHROPIC_API_KEY=${ans.anthropicKey ?? ''}`,
    `GOOGLE_API_KEY=${ans.googleKey ?? ''}`,
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
  if (!(await ensureDockerRunning(flags))) {
    // Docker is unavailable. Rather than dead-end here, fall back to the local
    // Postgres path when one is actually reachable: a broken Docker install
    // (Docker Desktop's privileged-helper repair is a common one on macOS)
    // should not stop the product from starting.
    const dbUrl = envFileVars(dir).DATABASE_URL || defaultDbUrl();
    if (!flags['no-fallback'] && (await pgReachable(dbUrl))) {
      log('');
      log(paint(C.amber, '  Docker is not available, but a local Postgres is.'));
      log(paint(C.dim, `  Starting without Docker against ${dbUrl}`));
      log(paint(C.dim, '  (force Docker instead with --no-fallback, once Docker is fixed.)'));
      log('');
      return devWith(dir, dbUrl, flags);
    }
    die(
      has('docker')
        ? 'Docker is installed but did not become ready, and no local Postgres was reachable.\n' +
            '\n' +
            '  Fix one of the two:\n' +
            '   1. Docker: open Docker Desktop and accept the admin prompt. If it keeps crashing on\n' +
            '      startup, reset it (Settings > Troubleshoot > Reset to factory defaults) or\n' +
            '      reinstall it from https://docs.docker.com/desktop/setup/install/mac-install/\n' +
            '   2. No Docker: start a local Postgres with pgvector, then re-run. On macOS:\n' +
            '        brew install postgresql@14 pgvector && brew services start postgresql@14\n' +
            '        createdb companybrain && psql -d companybrain -c "CREATE EXTENSION vector"\n' +
            '\n' +
            `  App directory: ${dir}`
        : 'Docker was not found and no local Postgres was reachable.\n' +
            '\n' +
            '  Either install Docker Desktop (https://docs.docker.com/get-docker/),\n' +
            '  or start a local Postgres with pgvector and re-run. On macOS:\n' +
            '    brew install postgresql@14 pgvector && brew services start postgresql@14\n' +
            '    createdb companybrain && psql -d companybrain -c "CREATE EXTENSION vector"',
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
  log('  Dashboard   ' + paint(C.amber, `http://localhost:${webPort}`));
  log(
    '  API         ' +
      paint(C.amber, `http://localhost:${apiPort}`) +
      paint(C.gray, '  (docs at /docs)'),
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
      paint(C.bold, '  Wire it into an AI agent (Claude Desktop / Cursor). Add to the MCP config:'),
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

/**
 * First port at or after `preferred` that nothing is listening on, skipping any
 * already claimed in this run. Returns null if the range is exhausted.
 */
async function findFreePort(preferred, taken = [], span = 20) {
  for (let port = preferred; port < preferred + span; port++) {
    if (taken.includes(port)) continue;
    if (!(await tcpReachable('127.0.0.1', port, 400))) return port;
  }
  return null;
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
 * Run the dev servers, rewriting turbo's task prefixes into short coloured
 * labels. `@companybrain/api:dev:` costs 22 columns on every line and pushes
 * the actual message off narrow terminals; `api ` reads better and keeps the
 * two streams distinguishable.
 */
function runDev(dir, args, extraEnv = {}) {
  return new Promise((resolve) => {
    const p = spawn('pnpm', args, {
      cwd: dir,
      stdio: ['inherit', 'pipe', 'pipe'],
      // Chosen ports win over the file, so a busy 3000 does not strand the
      // dashboard pointing at the wrong API.
      env: { ...process.env, ...envFileVars(dir), ...extraEnv },
    });
    const label = (line) =>
      line
        .replace(/^@companybrain\/api:dev:\s?/, paint(C.amber, 'api ') + ' ')
        .replace(/^@companybrain\/web:dev:\s?/, paint(C.green, 'web ') + ' ');
    const pipe = (stream, out) => {
      let buf = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        buf += chunk;
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const l of lines) out.write(label(l) + '\n');
      });
      stream.on('end', () => {
        if (buf) out.write(label(buf) + '\n');
      });
    };
    pipe(p.stdout, process.stdout);
    pipe(p.stderr, process.stderr);
    // Ctrl-C reaches the child through the shared process group; wait for it to
    // exit so its own shutdown output is not cut off.
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
  const dbUrl = flags.db ? String(flags.db) : envFileVars(dir).DATABASE_URL || defaultDbUrl();
  if (!(await pgReachable(dbUrl))) {
    die(
      `Cannot reach Postgres at ${dbUrl}.\n` +
        '  Start it and create the database with the vector extension, e.g. on macOS:\n' +
        '    brew install postgresql@14 pgvector && brew services start postgresql@14\n' +
        '    createdb companybrain && psql -d companybrain -c "CREATE EXTENSION vector"\n' +
        '  then re-run `npx companybrain dev`. (Or fix Docker and use `npx companybrain up`.)',
    );
  }
  return devWith(dir, dbUrl, flags);
}

/** The default local Postgres URL when the config does not name one. */
function defaultDbUrl() {
  return `postgres://${process.env.USER || 'postgres'}@127.0.0.1:5432/companybrain`;
}

/**
 * Bring the stack up without Docker against an already-reachable Postgres.
 * Shared by `dev` and by `up`'s fallback, so both behave identically.
 */
async function devWith(dir, dbUrl, flags = {}) {
  // Persist the connection so later runs (and `up`'s fallback) reuse it.
  if (!envFileVars(dir).DATABASE_URL) {
    appendFileSync(join(dir, '.env'), `DATABASE_URL=${dbUrl}\nAUTO_MIGRATE=true\n`);
  }
  if (!has('pnpm'))
    die('pnpm is required for the no-Docker path. Install it with `npm i -g pnpm`.');
  if (!existsSync(join(dir, 'node_modules'))) {
    log(paint(C.dim, 'Installing dependencies (first run, a few minutes) ...'));
    if ((await runStream('pnpm', ['install'], { cwd: dir })) !== 0) die('pnpm install failed.');
  }
  // Something else may hold the usual ports (an earlier run, another project).
  // Move to the next free pair rather than refusing to start; Next would
  // otherwise fail with a raw EADDRINUSE stack trace.
  const webPort = await findFreePort(Number(flags.port) || 3000);
  const apiPort = await findFreePort(Number(flags['api-port']) || 3333, [webPort]);
  if (webPort === null || apiPort === null) {
    die(
      'Could not find a free port for the dashboard and API.\n' +
        '  Free one up, or choose them yourself: --port=4000 --api-port=4333',
    );
  }
  // Only mention what actually moved; claiming both were busy when one was not
  // sends people hunting for a process that does not exist.
  const moved = [
    webPort !== 3000 ? `dashboard on ${webPort}` : null,
    apiPort !== 3333 ? `API on ${apiPort}` : null,
  ].filter(Boolean);
  if (moved.length) {
    log(paint(C.amber, `  Default port in use, so the ${moved.join(' and the ')} instead.`));
  }
  // The two halves have to agree: the dashboard calls the API by URL, and the
  // API only accepts the origins it is told about.
  const portEnv = {
    PORT: String(webPort),
    API_PORT: String(apiPort),
    NEXT_PUBLIC_API_URL: `http://localhost:${apiPort}`,
    CORS_ORIGINS: `http://localhost:${webPort},http://127.0.0.1:${webPort}`,
  };

  log(paint(C.dim, 'Running database migrations ...'));
  await runWithEnv(dir, 'pnpm', ['--filter', '@companybrain/db', 'migrate']);
  log('');
  log(paint(C.green, '  CompanyBrain is starting (no Docker).'));
  log('');
  log('  Dashboard   ' + paint(C.amber, `http://localhost:${webPort}`));
  log(
    '  API         ' +
      paint(C.amber, `http://localhost:${apiPort}`) +
      paint(C.gray, '  (docs at /docs)'),
  );
  log('');
  log(paint(C.gray, '  Logs stream below. Leave this window open; Ctrl-C stops both servers.'));
  log(paint(C.gray, '  ────────────────────────────────────────────────────────────────'));
  log('');
  // Run only the API + dashboard (not every package's dev task), in the
  // foreground, until the user presses Ctrl-C.
  //
  // --ui=stream, not turbo's interactive TUI: the TUI takes over the terminal,
  // hides the URLs behind a pane you have to navigate, and makes it unclear
  // that quitting it stops the servers. Plain prefixed lines scroll back, copy,
  // and pipe like any other log.
  await runDev(
    dir,
    [
      'exec',
      'turbo',
      'run',
      'dev',
      '--filter=@companybrain/api',
      '--filter=@companybrain/web',
      '--ui=stream',
      '--log-prefix=task',
    ],
    portEnv,
  );
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
  if (!(await ensureDockerRunning(flags))) die('Docker is not available; start Docker and retry.');
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
      if (!(await ensureDockerRunning(flags)))
        die('Docker is not available; start Docker and retry.');
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
      log('Flags: --yes (accept defaults / skip confirms), --dir=<path>, --no-mcp,');
      log('       --no-fallback (fail instead of running without Docker), --db=<url>,');
      log('       --retry-docker (try Docker again after fixing it),');
      log('       --port=<n> --api-port=<n> (pin the ports)\n');
      break;
    default:
      die(`Unknown command "${cmd}". Try: npx companybrain help`);
  }
}

main().catch((e) => die(String(e?.message ?? e)));
