/**
 * Smoke Test — 1 юзер, 30с. Перевіряє базову працездатність.
 * Запуск: k6 run load-tests/smoke.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  check(http.get(`${BASE}/`), { 'home 200': (r) => r.status === 200 });
  sleep(1);
  check(http.get(`${BASE}/catalog`), { 'catalog 200': (r) => r.status === 200 });
  sleep(1);
  check(http.get(`${BASE}/api/v1/health`), { 'health 200': (r) => r.status === 200 });
  sleep(1);
  check(http.get(`${BASE}/sitemap.xml`), { 'sitemap 200': (r) => r.status === 200 });
  sleep(1);
}
