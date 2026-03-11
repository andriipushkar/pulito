import { describe, it, expect } from 'vitest';
import manifest from './manifest';

describe('manifest', () => {
  it('returns a valid PWA manifest', () => {
    const result = manifest();
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('short_name');
    expect(result).toHaveProperty('start_url', '/');
    expect(result).toHaveProperty('display', 'standalone');
  });

  it('includes icons', () => {
    const result = manifest();
    expect(result.icons).toBeDefined();
    expect(result.icons!.length).toBeGreaterThanOrEqual(2);
  });
});
