import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({
   
  withRole: () => (handler: any) => handler,
}));
vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    APP_URL: 'https://test.com',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
  },
}));

const reorderMock = vi.fn();
vi.mock('@/services/image', () => {
  class ImageErrorMock extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    reorderProductImages: (...args: unknown[]) => reorderMock(...args),
    ImageError: ImageErrorMock,
  };
});
const cacheInvalidateMock = vi.fn();
vi.mock('@/services/cache', () => ({
  cacheInvalidate: (...args: unknown[]) => cacheInvalidateMock(...args),
}));

import { PATCH } from './route';
import { ImageError } from '@/services/image';

function makeReq(body: unknown) {
  return new Request('http://localhost/x', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

 
async function callPatch(body: unknown, id: string) {
  const req = makeReq(body);
  return PATCH(req as any, { params: Promise.resolve({ id }) } as any);
}

describe('PATCH /api/v1/admin/products/[id]/images/reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reorderMock.mockResolvedValue(undefined);
    cacheInvalidateMock.mockResolvedValue(1);
  });

  it('reorders and invalidates product cache', async () => {
    const res = await callPatch({ imageIds: [3, 1, 2] }, '42');
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(reorderMock).toHaveBeenCalledWith(42, [3, 1, 2]);
    expect(cacheInvalidateMock).toHaveBeenCalledWith('products:*');
  });

  it('rejects non-numeric product id', async () => {
    const res = await callPatch({ imageIds: [1] }, 'abc');
    expect(res.status).toBe(400);
    expect(reorderMock).not.toHaveBeenCalled();
  });

  it('rejects missing imageIds array', async () => {
    const res = await callPatch({ wrong: true }, '1');
    expect(res.status).toBe(400);
  });

  it('rejects imageIds containing non-integers', async () => {
    const res = await callPatch({ imageIds: [1, 'two', 3] }, '1');
    expect(res.status).toBe(400);
    expect(reorderMock).not.toHaveBeenCalled();
  });

  it('propagates ImageError status code', async () => {
    reorderMock.mockRejectedValueOnce(new ImageError('mismatch', 400));
    const res = await callPatch({ imageIds: [1, 2] }, '1');
    expect(res.status).toBe(400);
  });

  it('returns 500 on unknown error', async () => {
    reorderMock.mockRejectedValueOnce(new Error('boom'));
    const res = await callPatch({ imageIds: [1, 2] }, '1');
    expect(res.status).toBe(500);
  });
});
