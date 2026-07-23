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
