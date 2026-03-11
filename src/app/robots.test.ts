import { describe, it, expect } from 'vitest';
import robots from './robots';

describe('robots', () => {
  it('returns a valid robots config', () => {
    const result = robots();
    expect(result).toHaveProperty('rules');
    expect(result).toHaveProperty('sitemap');
    expect(result.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userAgent: '*', allow: '/' }),
      ])
    );
  });

  it('disallows admin and api paths', () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rule.disallow).toContain('/api/');
    expect(rule.disallow).toContain('/admin/');
  });

  it('uses APP_URL env variable for sitemap URL', () => {
    const origUrl = process.env.APP_URL;
    process.env.APP_URL = 'https://example.com';
    try {
      const result = robots();
      expect(result.sitemap).toBe('https://example.com/sitemap.xml');
    } finally {
      process.env.APP_URL = origUrl;
    }
  });

  it('falls back to localhost when APP_URL is not set', () => {
    const origUrl = process.env.APP_URL;
    delete process.env.APP_URL;
    try {
      const result = robots();
      expect(result.sitemap).toBe('http://localhost:3000/sitemap.xml');
    } finally {
      process.env.APP_URL = origUrl;
    }
  });
});
