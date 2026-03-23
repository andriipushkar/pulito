import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  tenant: {
    findUnique: vi.fn(),
  },
}));

const mockCacheGet = vi.hoisted(() => vi.fn());
const mockCacheSet = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/services/cache', () => ({
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
  CACHE_TTL: { SHORT: 60, MEDIUM: 300, LONG: 3600, DAY: 86400 },
}));

import { getTenantFromRequest, getTenantBySlug, getTenantByDomain } from './tenant';

const tenantData = {
  id: 1,
  slug: 'acme',
  domain: 'acme.com',
  plan: 'pro',
  settings: { theme: 'dark' },
};

function makeRequest(host: string): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    headers: { host },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('APP_URL', 'http://example.com');
});

describe('getTenantFromRequest', () => {
  it('resolves tenant by subdomain', async () => {
    mockCacheGet.mockResolvedValue(null);
    mockPrisma.tenant.findUnique.mockResolvedValue(tenantData);
    const req = makeRequest('acme.example.com');
    const result = await getTenantFromRequest(req);
    expect(result).toEqual(expect.objectContaining({ slug: 'acme' }));
  });

  it('resolves tenant by custom domain', async () => {
    mockCacheGet.mockResolvedValue(null);
    mockPrisma.tenant.findUnique.mockResolvedValue(tenantData);
    const req = makeRequest('acme.com');
    const result = await getTenantFromRequest(req);
    expect(result).toEqual(expect.objectContaining({ domain: 'acme.com' }));
  });

  it('returns null for the base domain itself', async () => {
    const req = makeRequest('example.com');
    const result = await getTenantFromRequest(req);
    expect(result).toBeNull();
  });

  it('returns null for localhost', async () => {
    const req = makeRequest('localhost');
    const result = await getTenantFromRequest(req);
    expect(result).toBeNull();
  });

  it('returns null when host header is missing', async () => {
    const req = new NextRequest('http://localhost/api/test');
    // NextRequest always has host, so override headers
    vi.spyOn(req.headers, 'get').mockReturnValue(null);
    const result = await getTenantFromRequest(req);
    expect(result).toBeNull();
  });
});

describe('getTenantBySlug', () => {
  it('returns cached tenant when available', async () => {
    mockCacheGet.mockResolvedValue(tenantData);
    const result = await getTenantBySlug('acme');
    expect(result).toEqual(tenantData);
    expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('queries database and caches result on cache miss', async () => {
    mockCacheGet.mockResolvedValue(null);
    mockPrisma.tenant.findUnique.mockResolvedValue(tenantData);
    const result = await getTenantBySlug('acme');
    expect(result).toEqual(expect.objectContaining({ slug: 'acme' }));
    expect(mockCacheSet).toHaveBeenCalledWith(
      'tenant:slug:acme',
      expect.objectContaining({ slug: 'acme' }),
      300
    );
  });

  it('returns null when tenant is not found in database', async () => {
    mockCacheGet.mockResolvedValue(null);
    mockPrisma.tenant.findUnique.mockResolvedValue(null);
    const result = await getTenantBySlug('nonexistent');
    expect(result).toBeNull();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });
});

describe('getTenantByDomain', () => {
  it('returns cached tenant when available', async () => {
    mockCacheGet.mockResolvedValue(tenantData);
    const result = await getTenantByDomain('acme.com');
    expect(result).toEqual(tenantData);
    expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('queries database and caches result on cache miss', async () => {
    mockCacheGet.mockResolvedValue(null);
    mockPrisma.tenant.findUnique.mockResolvedValue(tenantData);
    const result = await getTenantByDomain('acme.com');
    expect(result).toEqual(expect.objectContaining({ domain: 'acme.com' }));
    expect(mockCacheSet).toHaveBeenCalledWith(
      'tenant:domain:acme.com',
      expect.any(Object),
      300
    );
  });
});
