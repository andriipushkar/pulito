import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe('CoverImagePicker import', () => {
  it('module imports without hanging', async () => {
    const mod = await import('./CoverImagePicker');
    expect(typeof mod.default).toBe('function');
  });
});
