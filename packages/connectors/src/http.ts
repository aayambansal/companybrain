/**
 * Minimal HTTP helper built on the global `fetch` (Node 20+). No npm deps.
 */
import { isBlockedInternalTarget, urlBlockReason } from '@companybrain/core';

const USER_AGENT = 'CompanyBrain-Connector/0.1 (+https://github.com/aayambansal/companybrain)';

/**
 * Whether to refuse fetching internal/private/loopback URLs. Connectors fetch
 * user-configured URLs and store the response for the user to read, so an
 * unguarded fetch is a read-SSRF (a URL aimed at the cloud metadata endpoint or
 * an internal service would be exfiltrated). Internal sources (an intranet
 * wiki, a local feed) are a legitimate connector target though, so the default
 * is mode-aware: block in multi-tenant mode where users are untrusted, allow in
 * single-user mode (your own box). CONNECTOR_ALLOW_INTERNAL overrides either way.
 */
function blocksInternalTargets(): boolean {
  const flag = process.env.CONNECTOR_ALLOW_INTERNAL;
  if (flag === 'true') return false;
  if (flag === 'false') return true;
  return process.env.AUTH_MODE === 'multi';
}

/** Throw if the policy forbids fetching this (internal/private) URL. */
async function guardFetchTarget(url: string): Promise<void> {
  if (!blocksInternalTargets()) return;
  // Fast literal check first, then a DNS check for hostnames hiding an internal IP.
  if (urlBlockReason(url) !== null || (await isBlockedInternalTarget(url))) {
    throw new Error(`Refusing to fetch internal or private address: ${redactUrl(url)}`);
  }
}

/** Query-param names whose value must never appear in a log or error message. */
const SENSITIVE_PARAM = /token|secret|key|password|auth|credential|sig|access/i;

/**
 * Redact credential-looking query-param values so a URL is safe to put in an
 * error message. Some source APIs take the token in the query string (e.g.
 * `?api_token=...`); without this, a failed request would leak it into the
 * thrown error, which is stored on the sync run and shown in the dashboard.
 */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (SENSITIVE_PARAM.test(key)) u.searchParams.set(key, 'REDACTED');
    }
    return u.toString();
  } catch {
    // Not a parseable absolute URL; drop any query string to be safe.
    return url.split('?')[0] ?? url;
  }
}

/** Default per-request timeout so a slow source cannot hang a whole sync. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Statuses worth retrying: rate limiting and transient unavailability. */
const RETRY_STATUS = new Set([429, 503]);
const MAX_RETRIES = 4;
const MAX_RETRY_DELAY_MS = 60_000;

/**
 * Combine an optional caller signal with a timeout, so a request aborts on
 * either. Falls back to the timeout alone when AbortSignal.any is unavailable.
 */
export function requestSignal(
  signal: AbortSignal | undefined,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal;
}

/** Delay before the next attempt: honor `Retry-After`, else exponential backoff. */
export function retryDelayMs(retryAfter: string | null, attempt: number): number {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs)) return Math.min(Math.max(secs, 0) * 1000, MAX_RETRY_DELAY_MS);
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.min(Math.max(at - Date.now(), 0), MAX_RETRY_DELAY_MS);
  }
  return Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

/** Sleep that rejects promptly if the caller aborts. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      },
      { once: true },
    );
  });
}

/**
 * fetch() with a fresh timeout per attempt, retrying 429/503 with backoff that
 * honors `Retry-After`. Each attempt gets its own timeout signal so a retry is
 * not cut short by the first attempt's clock.
 */
async function fetchWithRetry(
  url: string,
  init: Omit<RequestInit, 'signal'>,
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...init, signal: requestSignal(callerSignal, timeoutMs) });
    if (!RETRY_STATUS.has(res.status) || attempt >= MAX_RETRIES) return res;
    await sleep(retryDelayMs(res.headers.get('retry-after'), attempt), callerSignal);
  }
}

/** GET a URL and return the response body as text. Throws on non-2xx. */
export async function fetchText(
  url: string,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  await guardFetchTarget(url);
  const res = await fetchWithRetry(
    url,
    { redirect: 'follow', headers: { 'user-agent': USER_AGENT, accept: '*/*' } },
    signal,
    timeoutMs,
  );
  if (!res.ok) {
    throw new Error(`GET ${redactUrl(url)} -> ${res.status} ${res.statusText}`);
  }
  return res.text();
}

export interface JsonRequest {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Fetch JSON with optional auth headers. Throws on non-2xx. */
export async function fetchJson<T = unknown>(url: string, opts: JsonRequest = {}): Promise<T> {
  await guardFetchTarget(url);
  const res = await fetchWithRetry(
    url,
    {
      method: opts.method ?? 'GET',
      redirect: 'follow',
      headers: {
        'user-agent': USER_AGENT,
        accept: 'application/json',
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    },
    opts.signal,
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `${opts.method ?? 'GET'} ${redactUrl(url)} -> ${res.status} ${res.statusText} ${text.slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}
