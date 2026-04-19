import { test, expect } from '@playwright/test';

test.describe('API Health', () => {
  test('should respond to health endpoint', async ({ request }) => {
    const response = await request.get('/api/v1/health');
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.status).toBe('healthy');
    expect(json.checks.database.status).toBe('ok');
  });
});
