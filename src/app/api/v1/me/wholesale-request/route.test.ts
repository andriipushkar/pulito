import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/services/telegram', () => ({
  notifyManagerFeedback: vi.fn(),
}));

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

import { GET, POST } from './route';
import { prisma } from '@/lib/prisma';

const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.user.update as ReturnType<typeof vi.fn>;
const authCtx = { user: { id: 1, email: 'test@test.com', role: 'client' } };

describe('GET /api/v1/me/wholesale-request', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns wholesale request status', async () => {
    mockFindUnique.mockResolvedValue({ wholesaleStatus: null, companyName: null });
    const req = new NextRequest('http://localhost/api/v1/me/wholesale-request');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 404 when user not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/v1/me/wholesale-request');
    const res = await GET(req, authCtx as any);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/me/wholesale-request', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits wholesale request', async () => {
    mockFindUnique.mockResolvedValue({ wholesaleStatus: null, role: 'client' });
    mockUpdate.mockResolvedValue({ wholesaleStatus: 'pending', wholesaleRequestDate: new Date(), companyName: 'Test Co' });
    const req = new NextRequest('http://localhost/api/v1/me/wholesale-request', {
      method: 'POST',
      body: JSON.stringify({
        companyName: 'Test Co',
        contactPersonName: 'John',
        contactPersonPhone: '+380501234567',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 when already pending', async () => {
    mockFindUnique.mockResolvedValue({ wholesaleStatus: 'pending', role: 'client' });
    const req = new NextRequest('http://localhost/api/v1/me/wholesale-request', {
      method: 'POST',
      body: JSON.stringify({
        companyName: 'Test Co',
        contactPersonName: 'John',
        contactPersonPhone: '+380501234567',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing required fields', async () => {
    mockFindUnique.mockResolvedValue({ wholesaleStatus: null, role: 'client' });
    const req = new NextRequest('http://localhost/api/v1/me/wholesale-request', {
      method: 'POST',
      body: JSON.stringify({ companyName: 'Test Co' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found for POST', async () => {
    mockFindUnique.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/v1/me/wholesale-request', {
      method: 'POST',
      body: JSON.stringify({ companyName: 'Test Co', contactPersonName: 'John', contactPersonPhone: '+380501234567' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 when already wholesaler', async () => {
    mockFindUnique.mockResolvedValue({ wholesaleStatus: null, role: 'wholesaler' });
    const req = new NextRequest('http://localhost/api/v1/me/wholesale-request', {
      method: 'POST',
      body: JSON.stringify({ companyName: 'Test Co', contactPersonName: 'John', contactPersonPhone: '+380501234567' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing companyName', async () => {
    mockFindUnique.mockResolvedValue({ wholesaleStatus: null, role: 'client' });
    const req = new NextRequest('http://localhost/api/v1/me/wholesale-request', {
      method: 'POST',
      body: JSON.stringify({ contactPersonName: 'John', contactPersonPhone: '+380501234567' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing contactPersonPhone', async () => {
    mockFindUnique.mockResolvedValue({ wholesaleStatus: null, role: 'client' });
    const req = new NextRequest('http://localhost/api/v1/me/wholesale-request', {
      method: 'POST',
      body: JSON.stringify({ companyName: 'Test Co', contactPersonName: 'John' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(400);
  });

  it('submits with all optional fields including edrpou and comment', async () => {
    mockFindUnique.mockResolvedValue({ wholesaleStatus: null, role: 'client' });
    mockUpdate.mockResolvedValue({ wholesaleStatus: 'pending', wholesaleRequestDate: new Date(), companyName: 'Test Co' });
    const req = new NextRequest('http://localhost/api/v1/me/wholesale-request', {
      method: 'POST',
      body: JSON.stringify({
        companyName: 'Test Co',
        edrpou: '12345678',
        contactPersonName: 'John',
        contactPersonPhone: '+380501234567',
        wholesaleMonthlyVol: '1000 kg',
        comment: 'Need bulk pricing',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(200);
  });

  it('handles telegram notification failure gracefully', async () => {
    const { notifyManagerFeedback } = await import('@/services/telegram');
    vi.mocked(notifyManagerFeedback).mockRejectedValue(new Error('telegram down'));
    mockFindUnique.mockResolvedValue({ wholesaleStatus: null, role: 'client' });
    mockUpdate.mockResolvedValue({ wholesaleStatus: 'pending', wholesaleRequestDate: new Date(), companyName: 'Test Co' });
    const req = new NextRequest('http://localhost/api/v1/me/wholesale-request', {
      method: 'POST',
      body: JSON.stringify({
        companyName: 'Test Co',
        contactPersonName: 'John',
        contactPersonPhone: '+380501234567',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, authCtx as any);
    expect(res.status).toBe(200);
  });
});
