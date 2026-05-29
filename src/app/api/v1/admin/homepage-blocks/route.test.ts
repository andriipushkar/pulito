import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  siteSetting: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/middleware/auth', () => ({
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/audit', () => ({ logAudit: vi.fn() }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/utils/api-response', () => ({
  successResponse: (data: unknown) => ({
    json: () => data,
    status: 200,
    data,
  }),
  errorResponse: (message: string, status: number) => ({
    json: () => ({ error: message }),
    status,
    message,
  }),
}));

import { GET, PUT } from './route';

const ctx = { user: { id: 1 } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/admin/homepage-blocks', () => {
  it('returns saved blocks plus updatedAt token when setting exists', async () => {
    const blocks = [
      { key: 'banner_slider', label: 'Банер-слайдер', enabled: true },
      { key: 'categories', label: 'Каталог категорій', enabled: false },
    ];
    const updatedAt = new Date('2024-02-01T00:00:00.000Z');

    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      id: 1,
      key: 'homepage_blocks',
      value: JSON.stringify(blocks),
      updatedBy: null,
      updatedAt,
    });

    const response = await (GET as Function)();

    expect(response.data.blocks.map((b: { key: string }) => b.key)).toEqual([
      'banner_slider',
      'categories',
    ]);
    expect(response.data.updatedAt).toBe(updatedAt);
  });

  it('returns default blocks with null token when no setting exists', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);

    const response = await (GET as Function)();

    expect(response.data.blocks.length).toBeGreaterThan(0);
    expect(response.data.blocks[0].key).toBe('banner_slider');
    expect(response.data.updatedAt).toBeNull();
  });

  it('returns error on database failure', async () => {
    mockPrisma.siteSetting.findUnique.mockRejectedValue(new Error('DB error'));

    const response = await (GET as Function)();

    expect(response.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/homepage-blocks', () => {
  const blocks = [
    { key: 'categories', label: 'Каталог категорій', enabled: true },
    { key: 'banner_slider', label: 'Банер-слайдер', enabled: false },
  ];

  it('creates the layout when no row exists yet', async () => {
    const saved = new Date('2024-02-01T00:00:00.000Z');
    mockPrisma.siteSetting.findUnique
      .mockResolvedValueOnce(null) // current
      .mockResolvedValueOnce({ updatedAt: saved }); // saved
    mockPrisma.siteSetting.create.mockResolvedValue({} as never);

    const req = { json: () => Promise.resolve({ blocks }) } as never;
    const response = await (PUT as Function)(req, ctx);

    expect(mockPrisma.siteSetting.create).toHaveBeenCalledWith({
      data: {
        key: 'homepage_blocks',
        value: JSON.stringify({ version: 1, blocks }),
        updatedBy: 1,
      },
    });
    expect(mockPrisma.siteSetting.updateMany).not.toHaveBeenCalled();
    expect(response.data).toEqual({ updated: true, updatedAt: saved });
  });

  it('updates atomically when token matches existing row', async () => {
    const current = new Date('2024-01-01T00:00:00.000Z');
    const saved = new Date('2024-02-01T00:00:00.000Z');
    mockPrisma.siteSetting.findUnique
      .mockResolvedValueOnce({ updatedAt: current })
      .mockResolvedValueOnce({ updatedAt: saved });
    mockPrisma.siteSetting.updateMany.mockResolvedValue({ count: 1 } as never);

    const req = {
      json: () => Promise.resolve({ blocks, expectedUpdatedAt: current.toISOString() }),
    } as never;
    const response = await (PUT as Function)(req, ctx);

    expect(mockPrisma.siteSetting.updateMany).toHaveBeenCalled();
    expect(mockPrisma.siteSetting.create).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it('returns 409 when token is stale', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValueOnce({
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    mockPrisma.siteSetting.updateMany.mockResolvedValue({ count: 0 } as never);

    const req = {
      json: () => Promise.resolve({ blocks, expectedUpdatedAt: '2023-12-01T00:00:00.000Z' }),
    } as never;
    const response = await (PUT as Function)(req, ctx);

    expect(response.status).toBe(409);
  });

  it('returns 409 when row exists but no token is sent (legacy array body)', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValueOnce({
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    const req = { json: () => Promise.resolve(blocks) } as never;
    const response = await (PUT as Function)(req, ctx);

    expect(response.status).toBe(409);
    expect(mockPrisma.siteSetting.updateMany).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid blocks', async () => {
    const req = { json: () => Promise.resolve({ blocks: 'nope' }) } as never;
    const response = await (PUT as Function)(req, ctx);

    expect(response.status).toBe(400);
  });

  it('returns 400 for empty array', async () => {
    const req = { json: () => Promise.resolve({ blocks: [] }) } as never;
    const response = await (PUT as Function)(req, ctx);

    expect(response.status).toBe(400);
  });

  it('returns error on database failure', async () => {
    mockPrisma.siteSetting.findUnique.mockRejectedValue(new Error('DB error'));

    const req = { json: () => Promise.resolve({ blocks }) } as never;
    const response = await (PUT as Function)(req, ctx);

    expect(response.status).toBe(500);
  });
});
