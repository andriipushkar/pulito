import { withRefreshLock } from './auth-refresh-lock';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  /** HTTP status code from the response. Surfaced so callers can branch on
   * 409 (optimistic-lock conflict), 403 (permission), etc. without parsing
   * the error message. */
  statusCode?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export interface RefreshSessionResult {
  accessToken: string | null;
  user: unknown | null;
}

// Module-level in-flight dedup for same-tab. Shared by api-client (lazy 401
// retries) and AuthProvider (mount-time hydration) — without sharing, both
// could fire /refresh in parallel and the second call would race the rotated
// cookie, tripping the server's refresh-token reuse detector and revoking
// every session of the user. Cross-tab dedup is via `withRefreshLock`
// (navigator.locks).
let refreshInFlight: Promise<RefreshSessionResult> | null = null;

export async function refreshSession(): Promise<RefreshSessionResult> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = withRefreshLock(async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!res.ok) return { accessToken: null, user: null };
      const data = await res.json();
      if (data.success && data.data?.accessToken) {
        accessToken = data.data.accessToken;
        return { accessToken: data.data.accessToken, user: data.data.user ?? null };
      }
      return { accessToken: null, user: null };
    } catch {
      return { accessToken: null, user: null };
    }
  }).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

// Back-compat thin wrapper for callers that only need the new access token.
export async function refreshAccessToken(): Promise<string | null> {
  const { accessToken: tok } = await refreshSession();
  return tok;
}

// On a fresh page load the in-memory access token is empty until AuthProvider
// re-hydrates it via /auth/refresh. React runs child effects before parent
// effects, so admin widgets (e.g. the layout's maintenance check) fire their
// first request BEFORE AuthProvider's mount refresh has run — with no Bearer
// token that request gets a guaranteed 401. The 401-retry below recovers it,
// but the failed attempt still shows up red in the console. Proactively
// hydrate once so the first protected request carries a token.
// refreshSession() dedupes in-flight calls, so this piggybacks on
// AuthProvider's refresh rather than doubling it; the once-guard keeps
// logged-out guests from re-refreshing on every subsequent request, and the
// guest /auth/refresh now returns a quiet 200 so there's no console noise.
let initialHydrationTried = false;

async function request<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  if (!accessToken && !initialHydrationTried) {
    initialHydrationTried = true;
    await refreshAccessToken();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(url, { ...options, headers, credentials: 'include' });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers, credentials: 'include' });
    }
  }

  const body = (await res.json()) as ApiResponse<T>;
  body.statusCode = res.status;
  return body;
}

interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export const apiClient = {
  get<T>(url: string, options?: RequestOptions) {
    return request<T>(url, { method: 'GET', headers: options?.headers, signal: options?.signal });
  },
  post<T>(url: string, body?: unknown, options?: RequestOptions) {
    return request<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers: options?.headers,
      signal: options?.signal,
    });
  },
  put<T>(url: string, body?: unknown, options?: RequestOptions) {
    return request<T>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers: options?.headers,
      signal: options?.signal,
    });
  },
  patch<T>(url: string, body?: unknown, options?: RequestOptions) {
    return request<T>(url, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      headers: options?.headers,
      signal: options?.signal,
    });
  },
  delete<T>(url: string, body?: unknown, options?: RequestOptions) {
    return request<T>(url, {
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: options?.headers,
      signal: options?.signal,
    });
  },
  // Fetch a binary response (e.g. a PDF) with the same Bearer auth + refresh
  // logic as request(). Returns a Blob; throws on a non-OK response, lifting
  // the server's JSON `error` message when present. Used for NP TTN printing,
  // where the print URL embeds the apiKey server-side and must be proxied.
  async download(url: string, options?: { method?: string; body?: unknown }): Promise<Blob> {
    const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
    if (options?.body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    const init: RequestInit = {
      method: options?.method || 'GET',
      headers,
      credentials: 'include',
      ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    };

    let res = await fetch(url, init);
    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(url, init);
      }
    }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = (await res.json()) as { error?: string };
        if (j.error) msg = j.error;
      } catch {
        /* response wasn't JSON */
      }
      throw new Error(msg);
    }
    return res.blob();
  },
  async upload<T>(url: string, formData: FormData): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let res = await fetch(url, { method: 'POST', headers, body: formData, credentials: 'include' });

    if (res.status === 401 && accessToken) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(url, { method: 'POST', headers, body: formData, credentials: 'include' });
      }
    }

    return res.json();
  },
};
