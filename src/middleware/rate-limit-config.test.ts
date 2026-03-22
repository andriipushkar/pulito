import { describe, it, expect } from 'vitest';
import { getRouteLimit, ROUTE_LIMITS } from './rate-limit-config';

describe('rate-limit-config', () => {
  describe('ROUTE_LIMITS', () => {
    it('has a default entry', () => {
      expect(ROUTE_LIMITS.default).toBeDefined();
      expect(ROUTE_LIMITS.default.max).toBeGreaterThan(0);
      expect(ROUTE_LIMITS.default.window).toBeGreaterThan(0);
    });

    it('auth route has strict limits', () => {
      expect(ROUTE_LIMITS['/api/v1/auth'].max).toBe(5);
    });

    it('reviews route has strict limits with long window', () => {
      expect(ROUTE_LIMITS['/api/v1/reviews'].max).toBe(5);
      expect(ROUTE_LIMITS['/api/v1/reviews'].window).toBe(900);
    });
  });

  describe('getRouteLimit', () => {
    it('returns exact match for known route', () => {
      const limit = getRouteLimit('/api/v1/auth/login');
      expect(limit.max).toBe(5);
      expect(limit.window).toBe(60);
    });

    it('matches prefix for nested routes', () => {
      const limit = getRouteLimit('/api/v1/orders/123/items');
      expect(limit.max).toBe(10);
    });

    it('returns default for unknown routes', () => {
      const limit = getRouteLimit('/api/v1/unknown-route');
      expect(limit).toEqual(ROUTE_LIMITS.default);
    });

    it('matches most specific (longest) prefix', () => {
      const limit = getRouteLimit('/api/v1/products/search?q=soap');
      expect(limit.max).toBe(30);
    });

    it('matches instant-search over generic products', () => {
      const limit = getRouteLimit('/api/v1/products/instant-search?q=soap');
      expect(limit.max).toBe(60);
    });

    it('returns admin limits for admin sub-routes', () => {
      const limit = getRouteLimit('/api/v1/admin/feature-flags');
      expect(limit.max).toBe(60);
    });

    it('returns cart limits for cart routes', () => {
      const limit = getRouteLimit('/api/v1/cart/items');
      expect(limit.max).toBe(30);
    });

    it('returns default for non-API paths', () => {
      const limit = getRouteLimit('/some/page');
      expect(limit).toEqual(ROUTE_LIMITS.default);
    });

    it('returns cron limits for cron routes', () => {
      const limit = getRouteLimit('/api/v1/cron/cleanup');
      expect(limit.max).toBe(5);
    });

    it('returns blog limits for blog routes', () => {
      const limit = getRouteLimit('/api/v1/blog/posts');
      expect(limit.max).toBe(60);
    });
  });
});
