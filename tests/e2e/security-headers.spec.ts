import { test, expect } from '@playwright/test';

test.describe('Security Headers', () => {
  test('should include all required security headers', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-xss-protection']).toBe('1; mode=block');
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(headers['x-request-id']).toBeTruthy();
  });

  test('should include CSP header with nonce', async ({ request }) => {
    const response = await request.get('/');
    const csp = response.headers()['content-security-policy'];

    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('nonce-');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  test('should include CSP report-uri when SENTRY_CSP_REPORT_URI is set', async ({ request }) => {
    const response = await request.get('/');
    const csp = response.headers()['content-security-policy'];

    // If SENTRY_CSP_REPORT_URI is configured, these directives should be present
    if (csp?.includes('report-uri')) {
      expect(csp).toContain('report-to csp-endpoint');

      const reportTo = response.headers()['report-to'];
      expect(reportTo).toBeTruthy();

      const reportToConfig = JSON.parse(reportTo!);
      expect(reportToConfig.group).toBe('csp-endpoint');
      expect(reportToConfig.endpoints).toHaveLength(1);
      expect(reportToConfig.endpoints[0].url).toBeTruthy();
    }
  });

  test('should include nonce header for client-side usage', async ({ request }) => {
    const response = await request.get('/');
    const nonce = response.headers()['x-nonce'];

    expect(nonce).toBeTruthy();
    expect(nonce).toMatch(/^[a-f0-9]{32}$/);
  });

  test('API routes should return rate-limit headers on 429', async ({ request }) => {
    // Send many rapid requests to trigger rate limiting
    const responses = [];
    for (let i = 0; i < 120; i++) {
      responses.push(request.get('/api/v1/health'));
    }
    const results = await Promise.all(responses);

    const rateLimited = results.find((r) => r.status() === 429);
    if (rateLimited) {
      const headers = rateLimited.headers();
      expect(headers['retry-after']).toBeTruthy();
      expect(headers['x-ratelimit-limit']).toBeTruthy();
    }
  });
});
