import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/middleware/auth', () => ({
  withAuth: (handler: Function) => handler,
  withOptionalAuth: (handler: Function) => handler,
  withRole: () => (handler: Function) => handler,
}));

vi.mock('@/services/performance', () => ({
  recordMetric: vi.fn(),
}));

vi.mock('@/services/client-events', () => ({
  recordClientEvent: vi.fn(),
}));

import { POST, GET } from './route';
import { recordMetric } from '@/services/performance';
import { recordClientEvent } from '@/services/client-events';

const mocked = vi.mocked(recordMetric);
const mockedRecordEvent = vi.mocked(recordClientEvent);

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/v1/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/metrics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records metric and returns 204', async () => {
    mocked.mockResolvedValue(undefined as never);
    const res = await POST(makeReq({ route: '/', metric: 'LCP', value: 100 }));
    expect(res.status).toBe(204);
  });

  it('returns 400 on missing fields', async () => {
    const res = await POST(makeReq({ route: '/' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid metric name', async () => {
    const res = await POST(makeReq({ route: '/', metric: 'INVALID', value: 100 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on parse error', async () => {
    const req = new NextRequest('http://localhost/api/v1/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/metrics (email open pixel)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRecordEvent.mockResolvedValue(undefined as never);
  });

  it('returns a 1x1 GIF for valid email_open requests', async () => {
    const req = new NextRequest('http://localhost/api/v1/metrics?type=email_open&id=abc123def456', {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/gif');
  });

  it('records an email_open event when id is valid', async () => {
    const req = new NextRequest('http://localhost/api/v1/metrics?type=email_open&id=abc123def456', {
      method: 'GET',
    });
    await GET(req);
    expect(mockedRecordEvent).toHaveBeenCalledWith({
      eventType: 'email_open',
      metadata: { trackingId: 'abc123def456' },
    });
  });

  it('still returns the GIF when params are missing/invalid (do not record)', async () => {
    const req = new NextRequest('http://localhost/api/v1/metrics?type=email_open', {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockedRecordEvent).not.toHaveBeenCalled();
  });

  it('rejects ids with disallowed characters', async () => {
    const req = new NextRequest('http://localhost/api/v1/metrics?type=email_open&id=<script>', {
      method: 'GET',
    });
    await GET(req);
    expect(mockedRecordEvent).not.toHaveBeenCalled();
  });
});
