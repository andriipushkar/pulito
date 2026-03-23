import { describe, it, expect } from 'vitest';
import { NextResponse } from 'next/server';
import { addApiVersionHeaders, addDeprecationHeaders } from './api-version';

describe('addApiVersionHeaders', () => {
  it('sets API-Version header to "1"', () => {
    const response = new NextResponse();
    const result = addApiVersionHeaders(response);
    expect(result.headers.get('API-Version')).toBe('1');
  });

  it('sets X-API-Version header to "1"', () => {
    const response = new NextResponse();
    const result = addApiVersionHeaders(response);
    expect(result.headers.get('X-API-Version')).toBe('1');
  });

  it('returns the same response object', () => {
    const response = new NextResponse();
    const result = addApiVersionHeaders(response);
    expect(result).toBe(response);
  });
});

describe('addDeprecationHeaders', () => {
  it('sets Deprecation header to "true"', () => {
    const response = new NextResponse();
    addDeprecationHeaders(response, '2026-06-01');
    expect(response.headers.get('Deprecation')).toBe('true');
  });

  it('sets Sunset header with UTC date string', () => {
    const response = new NextResponse();
    addDeprecationHeaders(response, '2026-06-01');
    const sunset = response.headers.get('Sunset');
    expect(sunset).toBe(new Date('2026-06-01').toUTCString());
  });

  it('sets Link header when link is provided', () => {
    const response = new NextResponse();
    addDeprecationHeaders(response, '2026-06-01', '/api/v2/resource');
    expect(response.headers.get('Link')).toBe('</api/v2/resource>; rel="successor-version"');
  });

  it('does not set Link header when link is not provided', () => {
    const response = new NextResponse();
    addDeprecationHeaders(response, '2026-06-01');
    expect(response.headers.get('Link')).toBeNull();
  });
});
