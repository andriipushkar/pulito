import { describe, it, expect } from 'vitest';

import { GET } from './route';

describe('GET /api/docs', () => {
  it('returns Swagger UI HTML page', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/html');
    const html = await res.text();
    expect(html).toContain('swagger-ui');
    expect(html).toContain('openapi.json');
  });
});
