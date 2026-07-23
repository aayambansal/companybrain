/**
 * Minimal HTTP helper built on the global `fetch` (Node 20+). No npm deps.
 */

const USER_AGENT = 'CompanyBrain-Connector/0.1 (+https://github.com/aayambansal/companybrain)';

/** GET a URL and return the response body as text. Throws on non-2xx. */
export async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, {
    signal,
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
}

/** Fetch JSON with optional auth headers. Throws on non-2xx. */
export async function fetchJson<T = unknown>(url: string, opts: JsonRequest = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    signal: opts.signal,
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
    throw new Error(`${opts.method ?? 'GET'} ${url} -> ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}
