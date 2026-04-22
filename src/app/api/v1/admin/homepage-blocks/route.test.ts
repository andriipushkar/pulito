import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  siteSetting: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/middleware/auth', () => ({
  withRole: () => (handler: Function) => handler,
}));

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/admin/homepage-blocks', () => {
  it('should return saved blocks when setting exists', async () => {
    const blocks = [
      { key: 'banner_slider', label: 'Банер-слайдер', enabled: true },
      { key: 'categories', label: 'Каталог категорій', enabled: false },
    ];

    mockPrisma.siteSetting.findUnique.mockResolvedValue({
      id: 1,
      key: 'homepage_blocks',
      value: JSON.stringify(blocks),
      updatedBy: null,
      updatedAt: new Date(),
    });

    const response = await (GET as Function)();

    expect(response.data).toEqual(blocks);
  });

  it('should return default blocks when no setting exists', async () => {
    mockPrisma.siteSetting.findUnique.mockResolvedValue(null);

    const response = await (GET as Function)();

    expect(response.data).toHaveLength(8);
    expect(response.data[0].key).toBe('banner_slider');
  });

  it('should return error on database failure', async () => {
    mockPrisma.siteSetting.findUnique.mockRejectedValue(new Error('DB error'));

    const response = await (GET as Function)();

    expect(response.status).toBe(500);
  });
});

describe('PUT /api/v1/admin/homepage-blocks', () => {
  it('should save blocks configuration', async () => {
    const blocks = [
      { key: 'categories', label: 'Каталог категорій', enabled: true },
      { key: 'banner_slider', label: 'Банер-слайдер', enabled: false },
    ];

    const mockRequest = {
      json: () => Promise.resolve(blocks),
    } as never;

    mockPrisma.siteSetting.upsert.mockResolvedValue({} as never);

    const response = await (PUT as Function)(mockRequest);

    expect(mockPrisma.siteSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'homepage_blocks' },
      update: { value: JSON.stringify(blocks) },
      create: { key: 'homepage_blocks', value: JSON.stringify(blocks) },
    });
    expect(response.data).toEqual({ updated: true });
  });

  it('should return error for invalid data', async () => {
    const mockRequest = {
      json: () => Promise.resolve('not-an-array'),
    } as never;

    const response = await (PUT as Function)(mockRequest);

    expect(response.status).toBe(400);
  });

  it('should return error for empty array', async () => {
    const mockRequest = {
      json: () => Promise.resolve([]),
    } as never;

    const response = await (PUT as Function)(mockRequest);

    expect(response.status).toBe(400);
  });

  it('should return error on database failure', async () => {
    const blocks = [{ key: 'banner_slider', label: 'Банер', enabled: true }];

    const mockRequest = {
      json: () => Promise.resolve(blocks),
    } as never;

    mockPrisma.siteSetting.upsert.mockRejectedValue(new Error('DB error'));

    const response = await (PUT as Function)(mockRequest);

    expect(response.status).toBe(500);
  });
});
