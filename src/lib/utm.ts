const COOKIE_NAME = 'pulito_utm';
const COOKIE_TTL_DAYS = 30;

export interface UtmParams {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

const UTM_KEYS: Array<keyof UtmParams> = ['utmSource', 'utmMedium', 'utmCampaign'];

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

/**
 * Read UTM params from the current URL and persist them in a cookie.
 * First-touch: existing UTM cookie is kept; subsequent visits without UTMs
 * don't wipe attribution. New non-empty UTMs do overwrite (last-touch within
 * the same session is intentional — that's where the click came from).
 */
export function captureUtmsFromUrl(): UtmParams | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const fromUrl: UtmParams = {};
  if (params.get('utm_source')) fromUrl.utmSource = params.get('utm_source')!.slice(0, 100);
  if (params.get('utm_medium')) fromUrl.utmMedium = params.get('utm_medium')!.slice(0, 100);
  if (params.get('utm_campaign')) fromUrl.utmCampaign = params.get('utm_campaign')!.slice(0, 100);

  if (Object.keys(fromUrl).length === 0) {
    return readStoredUtms();
  }

  writeCookie(COOKIE_NAME, JSON.stringify(fromUrl), COOKIE_TTL_DAYS);
  return fromUrl;
}

export function readStoredUtms(): UtmParams | null {
  const raw = readCookie(COOKIE_NAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: UtmParams = {};
    for (const key of UTM_KEYS) {
      const value = parsed[key];
      if (typeof value === 'string' && value.length > 0) out[key] = value;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}
