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

// Module-level in-flight dedup for same-tab. Cross-tab dedup is via
// `withRefreshLock` (navigator.locks).
let refreshInFlight: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = withRefreshLock(async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.success && data.data?.accessToken) {
        accessToken = data.data.accessToken;
        return accessToken;
      }
      return null;
    } catch {
      return null;
    }
  }).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
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
