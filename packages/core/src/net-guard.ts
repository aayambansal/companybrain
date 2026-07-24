/**
 * SSRF guard for outbound webhooks. Webhook URLs are user-controlled, so
 * delivery could otherwise be pointed at the cloud metadata endpoint, loopback,
 * or private-range services on the host's network. These helpers reject those
 * targets. Self-hosters who genuinely webhook to a local service opt back in
 * with WEBHOOK_ALLOW_INTERNAL=true.
 */
import { lookup } from 'node:dns/promises';

/** True if an IPv4 literal falls in a loopback/private/link-local/CGNAT range. */
export function isPrivateIpv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a > 255 || b > 255 || Number(m[3]) > 255 || Number(m[4]) > 255) return false;
  if (a === 0 || a === 10 || a === 127) return true; // this-host, private, loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 192 && b === 168) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (100.64/10)
  return false;
}

/** True if an IP literal (v4 or v6) is loopback/private/link-local/ULA. */
export function isPrivateIp(ip: string): boolean {
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (v6 === '::1' || v6 === '::') return true;
  if (v6.startsWith('fe80')) return true; // link-local
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true; // unique local (fc00::/7)
  const mapped = v6.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIpv4(mapped[1]!);
  return isPrivateIpv4(ip);
}

/**
 * Reason a webhook URL is rejected on its literal form (scheme + hostname),
 * or null if it looks acceptable. Catches non-http(s) schemes, localhost, and
 * literal private/loopback IPs without a DNS lookup.
 */
export function webhookUrlBlockReason(rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return 'must be a valid URL';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'must use http or https';
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return 'must not target localhost';
  // A literal IP (v4 has only digits/dots; v6 contains a colon).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
    if (isPrivateIp(host)) return 'must not target a private or loopback address';
  }
  return null;
}

/**
 * Resolve a hostname and report whether any address is internal. Best-effort:
 * on a resolution error it returns false (let the request proceed and fail on
 * its own) so a transient DNS hiccup doesn't silently drop legitimate delivery.
 */
export async function resolvesToInternal(hostname: string): Promise<boolean> {
  try {
    const results = await lookup(hostname, { all: true });
    return results.some((r) => isPrivateIp(r.address));
  } catch {
    return false;
  }
}

/**
 * Full check used at delivery time: literal rejection plus a DNS resolution
 * check for hostnames that hide an internal address. Returns true if the URL
 * must not be delivered to.
 */
export async function isBlockedWebhookTarget(rawUrl: string): Promise<boolean> {
  if (webhookUrlBlockReason(rawUrl) !== null) return true;
  try {
    return await resolvesToInternal(new URL(rawUrl).hostname);
  } catch {
    return true;
  }
}
