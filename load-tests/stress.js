import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Stress test — finds the breaking point of the application.
 * Usage: k6 run load-tests/stress.js
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up
    { duration: '2m', target: 100 },  // Push harder
    { duration: '2m', target: 200 },  // Stress zone
    { duration: '1m', target: 300 },  // Peak load
    { duration: '2m', target: 0 },    // Recovery
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'],    // <10% errors acceptable under stress
    http_req_duration: ['p(95)<5000'], // 95% under 5s under stress
  },
};

export default function stressTest() {
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/v1/health`],
    ['GET', `${BASE_URL}/api/v1/products?page=1&limit=12`],
    ['GET', `${BASE_URL}/api/v1/categories`],
  ]);

  responses.forEach((res, i) => {
    check(res, {
      [`batch[${i}]: status 200`]: (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 0.5 + 0.2);
}
