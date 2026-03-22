import { NextResponse } from 'next/server';

/**
 * Add API versioning headers to responses.
 */
export function addApiVersionHeaders(response: NextResponse): NextResponse {
  response.headers.set('API-Version', '1');
  response.headers.set('X-API-Version', '1');
  return response;
}

/**
 * Mark an endpoint as deprecated with sunset date.
 * Usage: addDeprecationHeaders(response, '2026-06-01')
 */
export function addDeprecationHeaders(
  response: NextResponse,
  sunsetDate: string,
  link?: string
): NextResponse {
  response.headers.set('Deprecation', 'true');
  response.headers.set('Sunset', new Date(sunsetDate).toUTCString());
  if (link) {
    response.headers.set('Link', `<${link}>; rel="successor-version"`);
  }
  return response;
}
