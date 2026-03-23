import { describe, it, expect } from 'vitest';

import { GET } from './route';

describe('GET /api/v1/ping', () => {
  it('returns status ok', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.timestamp).toBeDefined();
  });

  it('returns no-store cache header', () => {
    const res = GET();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
