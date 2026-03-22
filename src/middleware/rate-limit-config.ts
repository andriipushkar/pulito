export const ROUTE_LIMITS: Record<string, { max: number; window: number }> = {
  '/api/v1/auth': { max: 5, window: 60 },
  '/api/v1/products/search': { max: 30, window: 60 },
  '/api/v1/products/instant-search': { max: 60, window: 60 },
  '/api/v1/orders': { max: 10, window: 60 },
  '/api/v1/cart': { max: 30, window: 60 },
  '/api/v1/reviews': { max: 5, window: 900 },
  '/api/v1/wholesale': { max: 10, window: 60 },
  '/api/v1/me/subscriptions': { max: 10, window: 60 },
  '/api/v1/blog': { max: 60, window: 60 },
  '/api/v1/bundles': { max: 60, window: 60 },
  '/api/v1/calculator': { max: 20, window: 60 },
  '/api/v1/admin': { max: 60, window: 60 },
  '/api/v1/cron': { max: 5, window: 60 },
  default: { max: 100, window: 60 },
};

/**
 * Find the most specific route limit for a given pathname.
 * Matches longest prefix first, falls back to default.
 */
export function getRouteLimit(pathname: string): { max: number; window: number } {
  let bestMatch = '';

  for (const route of Object.keys(ROUTE_LIMITS)) {
    if (route === 'default') continue;
    if (pathname.startsWith(route) && route.length > bestMatch.length) {
      bestMatch = route;
    }
  }

  return ROUTE_LIMITS[bestMatch] || ROUTE_LIMITS.default;
}
