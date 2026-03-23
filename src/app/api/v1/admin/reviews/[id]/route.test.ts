import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/review', () => ({
  moderateReview: vi.fn(),
  replyToReview: vi.fn(),
  deleteReview: vi.fn(),
}));
vi.mock('@/validators/review', () => ({
  moderateReviewSchema: {
    safeParse: vi.fn((data: any) => {
      if (data.status === 'approved' || data.status === 'rejected') {
        return { success: true, data };
      }
      return { success: false, error: { issues: [{ message: 'Invalid status' }] } };
    }),
  },
  replyReviewSchema: {
    safeParse: vi.fn((data: any) => {
      if (data.adminReply) {
        return { success: true, data };
      }
      return { success: false, error: { issues: [{ message: 'Reply required' }] } };
    }),
  },
}));

import { PATCH, DELETE } from './route';
import { moderateReview, replyToReview, deleteReview } from '@/services/review';

describe('PATCH /api/v1/admin/reviews/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('moderates a review', async () => {
    vi.mocked(moderateReview).mockResolvedValue({ id: 1, status: 'approved' } as any);

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe('approved');
  });

  it('replies to a review', async () => {
    vi.mocked(replyToReview).mockResolvedValue({ id: 1, adminReply: 'Thanks!' } as any);

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminReply: 'Thanks!' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.adminReply).toBe('Thanks!');
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(moderateReview).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/v1/admin/reviews/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('deletes a review', async () => {
    vi.mocked(deleteReview).mockResolvedValue(undefined as any);

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: '1' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.deleted).toBe(true);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(deleteReview).mockRejectedValue(new Error('fail'));

    const req = new Request('http://localhost', { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: '1' }) });

    expect(res.status).toBe(500);
  });
});
