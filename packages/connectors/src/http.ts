/**
 * Minimal HTTP helper built on the global `fetch` (Node 20+). No npm deps.
 */

const USER_AGENT = 'CompanyBrain-Connector/0.1 (+https://github.com/aayambansal/companybrain)';

/** Default per-request timeout so a slow source cannot hang a whole sync. */
export const DEFAULT_TIMEOUT_MS = 30_000;

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

/** GET a URL and return the response body as text. Throws on non-2xx. */
export async function fetchText(
  url: string,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const res = await fetch(url, {
    signal: requestSignal(signal, timeoutMs),
    redirect: 'follow',
    headers: { 'user-agent': USER_AGENT, accept: '*/*' },
  });
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
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
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    signal: requestSignal(opts.signal, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    redirect: 'follow',
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json',
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `${opts.method ?? 'GET'} ${url} -> ${res.status} ${res.statusText} ${text.slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}
