/**
 * Load Test — нормальне навантаження для $5-$10 VPS.
 * Ramp up до 25 юзерів, тримати 3 хв, ramp down.
 * Імітує реальний трафік інтернет-магазину.
 *
 * Запуск: k6 run load-tests/load.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const XHR = { headers: { 'X-Requested-With': 'XMLHttpRequest' } };

const errorRate = new Rate('errors');
const homeDuration = new Trend('home_duration');
const catalogDuration = new Trend('catalog_duration');
const productDuration = new Trend('product_duration');
const apiDuration = new Trend('api_duration');

export const options = {
  stages: [
    { duration: '30s', target: 5 },   // warm up
    { duration: '30s', target: 15 },   // ramp up
    { duration: '3m', target: 25 },    // sustain — peak for cheap VPS
    { duration: '30s', target: 10 },   // ramp down
    { duration: '30s', target: 0 },    // cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
};

export default function () {
  group('Browse Homepage', () => {
    const r = http.get(`${BASE}/`);
    homeDuration.add(r.timings.duration);
    errorRate.add(r.status !== 200);
    check(r, { 'home 200': (r) => r.status === 200 });
    sleep(Math.random() * 3 + 1);
  });

  group('Browse Catalog', () => {
    const r = http.get(`${BASE}/catalog`);
    catalogDuration.add(r.timings.duration);
    errorRate.add(r.status !== 200);
    check(r, { 'catalog 200': (r) => r.status === 200 });
    sleep(Math.random() * 2 + 1);
  });

  group('Search Products', () => {
    const r = http.get(`${BASE}/api/v1/products/search?q=порошок&limit=10`, XHR);
    apiDuration.add(r.timings.duration);
    errorRate.add(r.status !== 200);
    check(r, { 'search 200': (r) => r.status === 200 });
    sleep(Math.random() * 2 + 0.5);
  });

  group('Product Page', () => {
    // Get first product slug from catalog
    const list = http.get(`${BASE}/api/v1/products?page=1&limit=1`, XHR);
    if (list.status === 200) {
      try {
        const slug = JSON.parse(list.body).data?.products?.[0]?.slug;
        if (slug) {
          const r = http.get(`${BASE}/product/${slug}`);
          productDuration.add(r.timings.duration);
          errorRate.add(r.status !== 200);
          check(r, { 'product 200': (r) => r.status === 200 });
        }
      } catch (_) {}
    }
    sleep(Math.random() * 3 + 2);
  });

  group('API Categories', () => {
    const r = http.get(`${BASE}/api/v1/categories`, XHR);
    apiDuration.add(r.timings.duration);
    check(r, { 'categories 200': (r) => r.status === 200 });
    sleep(Math.random() * 1 + 0.5);
  });
}
