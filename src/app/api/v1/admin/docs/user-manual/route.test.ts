import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({ env: { JWT_SECRET: 'test-jwt-secret-minimum-16-chars', JWT_ALGORITHM: 'HS256', JWT_PRIVATE_KEY_PATH: '', JWT_PUBLIC_KEY_PATH: '', APP_URL: 'https://test.com', CRON_SECRET: 'test-cron-secret', APP_SECRET: 'test-app-secret' } }));
vi.mock('@/middleware/auth', () => ({ withRole: (..._roles: string[]) => (handler: any) => handler }));
vi.mock('@/services/user-manual-pdf', () => ({
  generateUserManual: vi.fn(),
}));
vi.mock('@/utils/api-response', () => ({
  successResponse: (data: any, status = 200) => Response.json(data, { status }),
  errorResponse: (msg: string, status = 400) => Response.json({ error: msg }, { status }),
}));

import { POST } from './route';
import { generateUserManual } from '@/services/user-manual-pdf';

describe('POST /api/v1/admin/docs/user-manual', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('generates user manual on success', async () => {
    (generateUserManual as any).mockResolvedValue('https://example.com/manual.pdf');

    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.url).toBe('https://example.com/manual.pdf');
  });

  it('returns 500 on error', async () => {
    (generateUserManual as any).mockRejectedValue(new Error('fail'));

    const res = await POST();

    expect(res.status).toBe(500);
  });
});
