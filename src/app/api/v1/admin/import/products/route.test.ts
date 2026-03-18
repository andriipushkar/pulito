import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/middleware/auth', () => ({ withRole: () => (handler: Function) => handler }));
vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret' } }));

const mockImportProducts = vi.fn();
vi.mock('@/services/import', () => {
  class ImportError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    importProducts: (...args: any[]) => mockImportProducts(...args),
    ImportError,
  };
});

import { POST } from './route';

const mockCtx = { user: { id: 1 } };

function createFileFormData(name: string, size: number = 100): Request {
  const content = new Uint8Array(size);
  const file = new File([content], name, { type: 'application/octet-stream' });
  const formData = new FormData();
  formData.append('file', file);
  return new Request('http://localhost', { method: 'POST', body: formData });
}

describe('POST /api/v1/admin/import/products', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 when no file provided', async () => {
    const formData = new FormData();
    const req = new Request('http://localhost', { method: 'POST', body: formData });
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for unsupported file format', async () => {
    const req = createFileFormData('test.txt');
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('.xlsx');
  });

  it('returns 400 when file exceeds 10MB', async () => {
    const req = createFileFormData('test.xlsx', 11 * 1024 * 1024);
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('10 МБ');
  });

  it('imports products successfully', async () => {
    mockImportProducts.mockResolvedValue({ imported: 5, skipped: 1 });
    const req = createFileFormData('products.xlsx');
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.imported).toBe(5);
    expect(mockImportProducts).toHaveBeenCalledWith(expect.any(Buffer), 'products.xlsx', 1);
  });

  it('handles csv format', async () => {
    mockImportProducts.mockResolvedValue({ imported: 1 });
    const req = createFileFormData('products.csv');
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('handles xls format', async () => {
    mockImportProducts.mockResolvedValue({ imported: 1 });
    const req = createFileFormData('products.xls');
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(200);
  });

  it('handles ImportError', async () => {
    const { ImportError } = await import('@/services/import');
    mockImportProducts.mockRejectedValue(new ImportError('Invalid columns', 422));
    const req = createFileFormData('products.xlsx');
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('Invalid columns');
  });

  it('returns 500 on unexpected error', async () => {
    const req = { formData: () => { throw new Error('fail'); } } as any;
    const res = await POST(req, mockCtx as any);
    expect(res.status).toBe(500);
  });

  it('returns 400 for file with no extension', async () => {
    const req = createFileFormData('datafile');
    const res = await POST(req as any, mockCtx as any);
    expect(res.status).toBe(400);
  });
});
