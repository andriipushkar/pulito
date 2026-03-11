import { describe, it, expect } from 'vitest';

import { GET } from './route';

describe('GET /api-docs', () => {
  it('returns HTML page on success', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
  });

  it('contains swagger-ui reference', async () => {
    const res = await GET();
    const html = await res.text();
    expect(html).toContain('swagger-ui');
  });
});
