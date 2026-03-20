import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockRedis } = vi.hoisted(() => {
  return {
    mockPrisma: {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    },
    mockRedis: {
      ping: vi.fn().mockResolvedValue('PONG'),
    },
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/redis', () => ({
  redis: mockRedis,
}));

// Mock fetch for Typesense health check
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', mockFetch);

import { GET } from './route';

describe('GET /api/v1/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockRedis.ping.mockResolvedValue('PONG');
  });

  it('should return healthy when all services are ok', async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.checks.database.status).toBe('ok');
    expect(body.checks.redis.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    // Public health endpoint no longer exposes latency, memory, or loadAvg
    expect(body.memory).toBeUndefined();
    expect(body.loadAvg).toBeUndefined();
    expect(body.uptime).toBeUndefined();
  });

  it('should return degraded when database is down', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks.database.status).toBe('error');
    // Error details no longer exposed publicly
    expect(body.checks.database.error).toBeUndefined();
    expect(body.checks.redis.status).toBe('ok');
  });

  it('should return degraded when redis is down', async () => {
    mockRedis.ping.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks.database.status).toBe('ok');
    expect(body.checks.redis.status).toBe('error');
  });

  it('should return degraded when both services are down', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'));
    mockRedis.ping.mockRejectedValue(new Error('Redis down'));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.checks.database.status).toBe('error');
    expect(body.checks.redis.status).toBe('error');
  });

  it('should include ISO timestamp', async () => {
    const res = await GET();
    const body = await res.json();

    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
