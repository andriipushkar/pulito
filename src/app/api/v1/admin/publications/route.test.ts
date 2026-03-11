import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetPublications = vi.fn();
const mockCreatePublication = vi.fn();

vi.mock('@/services/publication', () => ({
  getPublications: (...args: unknown[]) => mockGetPublications(...args),
  createPublication: (...args: unknown[]) => mockCreatePublication(...args),
  PublicationError: class PublicationError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('@/middleware/auth', () => ({
  withRole: () => (handler: Function) => {
    return (request: NextRequest, segmentData?: unknown) => {
      return handler(request, { user: { id: 1, role: 'admin' }, params: (segmentData as { params?: unknown })?.params });
    };
  },
  withAuth: (handler: Function) => handler,
}));

vi.mock('@/config/env', () => ({
  env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars' },
}));

import { GET, POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/admin/publications', () => {
  it('should return paginated publications', async () => {
    mockGetPublications.mockResolvedValue({ publications: [{ id: 1, title: 'Test' }], total: 1 });

    const request = new NextRequest('http://localhost/api/v1/admin/publications');
    const res = await GET(request);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('should pass query params to service', async () => {
    mockGetPublications.mockResolvedValue({ publications: [], total: 0 });

    const request = new NextRequest('http://localhost/api/v1/admin/publications?page=2&status=draft');
    await GET(request);

    expect(mockGetPublications).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, status: 'draft' })
    );
  });

  it('should return 500 on error', async () => {
    mockGetPublications.mockRejectedValue(new Error('DB error'));

    const request = new NextRequest('http://localhost/api/v1/admin/publications');
    const res = await GET(request);

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/admin/publications', () => {
  it('should create publication and return 201', async () => {
    const created = { id: 1, title: 'New Pub', status: 'draft' };
    mockCreatePublication.mockResolvedValue(created);

    const request = new NextRequest('http://localhost/api/v1/admin/publications', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Pub', content: 'Content', channels: ['telegram'] }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(request, { user: { id: 1, role: 'admin' } } as never);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('New Pub');
  });

  it('should return PublicationError status code', async () => {
    const { PublicationError } = await import('@/services/publication');
    mockCreatePublication.mockRejectedValue(new PublicationError('invalid data'));

    const request = new NextRequest('http://localhost/api/v1/admin/publications', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', content: 'Test', channels: [] }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(request, { user: { id: 1, role: 'admin' } } as never);
    expect(res.status).toBe(400);
  });

  it('should return 500 on unexpected error', async () => {
    mockCreatePublication.mockRejectedValue(new Error('Unexpected'));

    const request = new NextRequest('http://localhost/api/v1/admin/publications', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', content: 'Test', channels: [] }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(request, { user: { id: 1, role: 'admin' } } as never);
    expect(res.status).toBe(500);
  });
});
