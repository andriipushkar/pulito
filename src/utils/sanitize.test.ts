import { describe, it, expect, vi } from 'vitest';

vi.mock('isomorphic-dompurify', () => ({
  default: {
    sanitize: vi.fn((dirty: string, _opts: unknown) => {
      // Simple mock that strips script tags
      return dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }),
  },
}));

import { sanitizeHtml } from './sanitize';

describe('sanitizeHtml', () => {
  it('returns sanitized HTML', () => {
    const result = sanitizeHtml('<p>Hello</p>');
    expect(result).toBe('<p>Hello</p>');
  });

  it('strips script tags', () => {
    const result = sanitizeHtml('<p>Safe</p><script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('<p>Safe</p>');
  });

  it('handles empty string', () => {
    const result = sanitizeHtml('');
    expect(result).toBe('');
  });
});
