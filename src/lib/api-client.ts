export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
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

async function refreshAccessToken(): Promise<string | null> {
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
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
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

  return res.json();
}

export const apiClient = {
  get<T>(url: string) {
    return request<T>(url, { method: 'GET' });
  },
  post<T>(url: string, body?: unknown) {
    return request<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  put<T>(url: string, body?: unknown) {
    return request<T>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  patch<T>(url: string, body?: unknown) {
    return request<T>(url, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  delete<T>(url: string) {
    return request<T>(url, { method: 'DELETE' });
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
