// Centralised URL safety check for admin-supplied links (banner buttonLink,
// campaign CTAs, etc). Blocks `javascript:`, `data:`, `vbscript:` and similar
// schemes that would render the link as XSS. Allows http(s), tel:, mailto:,
// and same-origin paths starting with `/`.
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function isSafeUrl(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = String(value).trim();
  if (trimmed === '') return true;
  if (trimmed.startsWith('/')) return !trimmed.startsWith('//'); // protocol-relative is unsafe (loads cross-origin)
  try {
    const url = new URL(trimmed);
    return ALLOWED_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// SSRF-prevention helpers — used by every server-side fetch triggered by
// admin/user input (supplier feeds, webhooks, SMTP tests, image imports).
// ---------------------------------------------------------------------------

function isPrivateIPv4(octets: number[]): boolean {
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return false;
  }
  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + AWS/GCP metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224 && a <= 239) return true; // multicast
  return false;
}

function parseIPv4(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((p) => Number(p));
  return octets.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? octets : null;
}

/**
 * Returns true if `url` is a syntactically valid http(s) URL that does NOT
 * point to a private/loopback/link-local/CGNAT/multicast address (IPv4 or IPv6)
 * and does NOT resolve to `localhost`/`*.local`/`*.internal`. Defaults to
 * `https:`-only — pass `protocols: ['http:', 'https:']` for legacy callers
 * that must still accept plain http.
 */
export function isSafeOutboundUrl(url: string, options: { protocols?: string[] } = {}): boolean {
  const protocols = options.protocols ?? ['https:'];
  try {
    const parsed = new URL(url);
    if (!protocols.includes(parsed.protocol)) return false;

    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }

    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return false;
    }

    const ipv4 = parseIPv4(hostname);
    if (ipv4) return !isPrivateIPv4(ipv4);

    if (hostname.includes(':')) {
      if (hostname === '::1' || hostname === '::') return false;
      if (/^fe[89ab][0-9a-f]?:/.test(hostname)) return false;
      if (/^f[cd][0-9a-f]{2}:/.test(hostname)) return false;
      const mapped = hostname.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
      if (mapped) {
        const inner = parseIPv4(mapped[1]);
        if (inner && isPrivateIPv4(inner)) return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Webhook-URL rule: https:// is always accepted (and SSRF-checked);
 * http://localhost / 127.0.0.1 / ::1 is only accepted in non-production for
 * local-dev receivers. Everything else is rejected.
 */
export function isSafeWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') {
      return isSafeOutboundUrl(url, { protocols: ['https:'] });
    }
    if (parsed.protocol === 'http:') {
      const isLocalDev =
        process.env.NODE_ENV !== 'production' &&
        ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname.toLowerCase());
      return isLocalDev;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Same rules but for an SMTP host (no scheme). Blocks the same private ranges
 * + localhost so the SMTP-test endpoint can't be aimed at an internal service
 * for port-scanning or metadata reads.
 */
export function isSafeSmtpHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (!h) return false;
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;

  const ipv4 = parseIPv4(h);
  if (ipv4) return !isPrivateIPv4(ipv4);

  if (h.includes(':')) {
    if (h === '::1' || h === '::') return false;
    if (/^fe[89ab][0-9a-f]?:/.test(h)) return false;
    if (/^f[cd][0-9a-f]{2}:/.test(h)) return false;
  }

  return true;
}
