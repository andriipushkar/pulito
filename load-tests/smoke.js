import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Smoke test — basic checks that endpoints respond correctly under minimal load.
 * Usage: k6 run load-tests/smoke.js
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 1,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<0.01'],  // <1% errors
    http_req_duration: ['p(95)<2000'], // 95% requests under 2s
  },
};

export default function smokeTest() {
  // Health check
  const healthRes = http.get(`${BASE_URL}/api/v1/health`);
  check(healthRes, {
    'health: status 200': (r) => r.status === 200,
    'health: success true': (r) => r.json('success') === true,
  });

  // Homepage
  const homeRes = http.get(`${BASE_URL}/`);
  check(homeRes, {
    'homepage: status 200': (r) => r.status === 200,
  });

  // Catalog
  const catalogRes = http.get(`${BASE_URL}/catalog`);
  check(catalogRes, {
    'catalog: status 200': (r) => r.status === 200,
  });

  // Products API
  const productsRes = http.get(`${BASE_URL}/api/v1/products?page=1&limit=12`);
  check(productsRes, {
    'products API: status 200': (r) => r.status === 200,
    'products API: has data': (r) => r.json('success') === true,
  });

  // Categories API
  const categoriesRes = http.get(`${BASE_URL}/api/v1/categories`);
  check(categoriesRes, {
    'categories API: status 200': (r) => r.status === 200,
  });

  // Sitemap
  const sitemapRes = http.get(`${BASE_URL}/sitemap.xml`);
  check(sitemapRes, {
    'sitemap: status 200': (r) => r.status === 200,
  });

  sleep(1);
}
