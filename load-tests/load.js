import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Load test — simulates normal traffic patterns.
 * Usage: k6 run load-tests/load.js
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 20 },   // Stay at 20 users
    { duration: '30s', target: 50 },  // Ramp up to 50
    { duration: '1m', target: 50 },   // Stay at 50
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],    // <5% errors
    http_req_duration: ['p(95)<3000'], // 95% under 3s
    http_req_duration: ['p(99)<5000'], // 99% under 5s
  },
};

// Simulate a typical browsing session
export default function loadTest() {
  // 1. Visit homepage
  http.get(`${BASE_URL}/`);
  sleep(Math.random() * 2 + 1);

  // 2. Browse catalog
  const page = Math.floor(Math.random() * 3) + 1;
  const catalogRes = http.get(`${BASE_URL}/api/v1/products?page=${page}&limit=12`);
  check(catalogRes, {
    'catalog: status ok': (r) => r.status === 200,
  });
  sleep(Math.random() * 3 + 1);

  // 3. View a product (simulate by hitting products endpoint)
  const promoRes = http.get(`${BASE_URL}/api/v1/products/promo`);
  check(promoRes, {
    'promo: status ok': (r) => r.status === 200,
  });
  sleep(Math.random() * 2 + 1);

  // 4. Search
  const queries = ['мийний', 'порошок', 'засіб', 'чистка', 'гель'];
  const q = queries[Math.floor(Math.random() * queries.length)];
  const searchRes = http.get(`${BASE_URL}/api/v1/products/search?q=${q}`);
  check(searchRes, {
    'search: status ok': (r) => r.status === 200,
  });
  sleep(Math.random() * 2 + 1);

  // 5. View categories
  const catRes = http.get(`${BASE_URL}/api/v1/categories`);
  check(catRes, {
    'categories: status ok': (r) => r.status === 200,
  });
  sleep(Math.random() * 1 + 0.5);
}
