import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';

const mockPrisma = vi.hoisted(() => ({
  apiKey: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/utils/api-response', () => ({
  errorResponse: (msg: string, status: number) => {
    const { NextResponse } = require('next/server');
    return NextResponse.json({ success: false, error: msg }, { status });
  },
}));

import { withApiKey, generateApiKey } from './api-key-auth';

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  const h = new Headers(headers);
  return new NextRequest('http://localhost/api/v1/test', { headers: h });
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

const validKey = {
  id: 1,
  name: 'Test Key',
  keyHash: 'abc',
  isActive: true,
  expiresAt: null,
  permissions: { read: true, write: true },
  lastUsedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('withApiKey', () => {
  it('returns 401 when no API key is provided', async () => {
    const handler = vi.fn();
    const wrapped = withApiKey()(handler);
    const res = await wrapped(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('API key not provided');
    expect(handler).not.toHaveBeenCalled();
  });

  it('extracts key from Authorization Bearer header', async () => {
    const rawKey = 'test-key-123';
    mockPrisma.apiKey.findUnique.mockResolvedValue({ ...validKey, keyHash: hashKey(rawKey) });
    const handler = vi.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withApiKey()(handler);
    await wrapped(makeRequest({ authorization: `Bearer ${rawKey}` }));
    expect(mockPrisma.apiKey.findUnique).toHaveBeenCalledWith({
      where: { keyHash: hashKey(rawKey) },
    });
    expect(handler).toHaveBeenCalled();
  });

  it('extracts key from X-API-Key header', async () => {
    const rawKey = 'x-api-key-value';
    mockPrisma.apiKey.findUnique.mockResolvedValue({ ...validKey, keyHash: hashKey(rawKey) });
    const handler = vi.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withApiKey()(handler);
    await wrapped(makeRequest({ 'x-api-key': rawKey }));
    expect(handler).toHaveBeenCalled();
  });

  it('returns 401 for invalid (unknown) API key', async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue(null);
    const handler = vi.fn();
    const wrapped = withApiKey()(handler);
    const res = await wrapped(makeRequest({ authorization: 'Bearer bad-key' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid API key');
  });

  it('returns 403 for deactivated key', async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue({ ...validKey, isActive: false });
    const handler = vi.fn();
    const wrapped = withApiKey()(handler);
    const res = await wrapped(makeRequest({ authorization: 'Bearer some-key' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('API key is deactivated');
  });

  it('returns 403 for expired key', async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue({
      ...validKey,
      expiresAt: new Date('2020-01-01'),
    });
    const handler = vi.fn();
    const wrapped = withApiKey()(handler);
    const res = await wrapped(makeRequest({ authorization: 'Bearer some-key' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('API key has expired');
  });

  it('returns 403 for insufficient permissions', async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue({
      ...validKey,
      permissions: { read: true, write: false },
    });
    const handler = vi.fn();
    const wrapped = withApiKey(['read', 'write'])(handler);
    const res = await wrapped(makeRequest({ authorization: 'Bearer some-key' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Insufficient permissions');
  });

  it('updates lastUsedAt on successful auth', async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue(validKey);
    const handler = vi.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withApiKey()(handler);
    await wrapped(makeRequest({ authorization: 'Bearer some-key' }));
    expect(mockPrisma.apiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { lastUsedAt: expect.any(Date) },
      })
    );
  });
});

describe('generateApiKey', () => {
  it('returns rawKey, keyHash, and prefix', () => {
    const result = generateApiKey();
    expect(result.rawKey).toMatch(/^csk_/);
    expect(result.prefix).toBe(result.rawKey.slice(0, 8));
    expect(result.keyHash).toBe(hashKey(result.rawKey));
  });
});
