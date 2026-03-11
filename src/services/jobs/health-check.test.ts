import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
  NOVA_POSHTA_API_KEY: 'test-np-key',
  LIQPAY_PUBLIC_KEY: 'test-liqpay-key',
  SMTP_HOST: 'smtp.test.com',
  SMTP_USER: 'user@test.com',
}));

vi.mock('@/config/env', () => ({
  env: mockEnv,
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock dns
vi.mock('dns', () => ({
  promises: {
    resolve: vi.fn().mockResolvedValue(['127.0.0.1']),
  },
}));

import { runHealthChecks } from './health-check';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runHealthChecks', () => {
  it('should return OK for all services when they respond', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const result = await runHealthChecks();

    expect(result.results).toHaveLength(3);
    expect(result.results[0].service).toBe('nova_poshta');
    expect(result.results[0].status).toBe('ok');
    expect(result.results[1].service).toBe('liqpay');
    expect(result.results[2].service).toBe('smtp');
    expect(result.allHealthy).toBe(true);
  });

  it('should report error when a service fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 }) // Nova Poshta fails
      .mockResolvedValueOnce({ ok: true, status: 200 }); // LiqPay ok

    const result = await runHealthChecks();

    expect(result.results[0].status).toBe('error');
    expect(result.allHealthy).toBe(false);
  });

  it('should include latency for each check', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const result = await runHealthChecks();

    for (const r of result.results) {
      expect(r.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('should handle LiqPay 405 as ok', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200 })   // Nova Poshta OK
      .mockResolvedValueOnce({ ok: false, status: 405 });  // LiqPay 405 (Method Not Allowed) — treated as OK

    const result = await runHealthChecks();

    expect(result.results[1].service).toBe('liqpay');
    expect(result.results[1].status).toBe('ok');
  });

  it('should handle non-Error thrown objects', async () => {
    mockFetch.mockImplementation(() => { throw 'non-error-string'; });

    const result = await runHealthChecks();

    expect(result.results[0].status).toBe('error');
    expect(result.results[0].error).toBe('Unknown error');
    expect(result.allHealthy).toBe(false);
  });

  it('should report error when Nova Poshta API key is missing', async () => {
    const original = mockEnv.NOVA_POSHTA_API_KEY;
    mockEnv.NOVA_POSHTA_API_KEY = '';
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const result = await runHealthChecks();

    expect(result.results[0].service).toBe('nova_poshta');
    expect(result.results[0].status).toBe('error');
    expect(result.results[0].error).toContain('not configured');
    mockEnv.NOVA_POSHTA_API_KEY = original;
  });

  it('should report error when LiqPay key is missing', async () => {
    const original = mockEnv.LIQPAY_PUBLIC_KEY;
    mockEnv.LIQPAY_PUBLIC_KEY = '';
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const result = await runHealthChecks();

    expect(result.results[1].service).toBe('liqpay');
    expect(result.results[1].status).toBe('error');
    expect(result.results[1].error).toContain('not configured');
    mockEnv.LIQPAY_PUBLIC_KEY = original;
  });

  it('should report error when SMTP is not configured', async () => {
    const originalHost = mockEnv.SMTP_HOST;
    mockEnv.SMTP_HOST = '';
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const result = await runHealthChecks();

    expect(result.results[2].service).toBe('smtp');
    expect(result.results[2].status).toBe('error');
    expect(result.results[2].error).toContain('not configured');
    mockEnv.SMTP_HOST = originalHost;
  });

  it('should report error when Nova Poshta returns non-ok response', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503 })  // Nova Poshta
      .mockResolvedValueOnce({ ok: true, status: 200 });   // LiqPay

    const result = await runHealthChecks();

    expect(result.results[0].status).toBe('error');
    expect(result.results[0].error).toContain('HTTP 503');
  });

  it('should report error when LiqPay returns non-ok non-405 response', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200 })    // Nova Poshta
      .mockResolvedValueOnce({ ok: false, status: 500 });   // LiqPay

    const result = await runHealthChecks();

    expect(result.results[1].status).toBe('error');
    expect(result.results[1].error).toContain('HTTP 500');
  });
});
