import { NextResponse } from 'next/server';
import type { ApiResponse, PaginatedResponse } from '@/types/api';

export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Like successResponse, but marks the payload as private to caches.
 * Use for any endpoint that returns per-user data (profile, orders, cart,
 * notifications) so shared CDNs/proxies never store another user's response.
 */
export function privateResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  const res = NextResponse.json({ success: true, data }, { status });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

/** Paginated variant of privateResponse for per-user lists. */
export function privatePaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): NextResponse<PaginatedResponse<T>> {
  const res = NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export function errorResponse(error: string, status = 400): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status });
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export function parseSearchParams(searchParams: URLSearchParams) {
  return {
    page: Math.max(1, Number(searchParams.get('page')) || 1),
    limit: Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20)),
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: (searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
    search: searchParams.get('search') || undefined,
  };
}
