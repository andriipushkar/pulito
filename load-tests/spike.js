/**
 * Spike Test — раптовий сплеск трафіку (розпродаж, вірусний пост).
 * 5 юзерів → 80 юзерів за 10 секунд → тримати 1 хв → назад.
 *
 * Запуск: k6 run load-tests/spike.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 5 },    // нормальний трафік
    { duration: '10s', target: 80 },    // SPIKE!
    { duration: '1m', target: 80 },     // тримати пік
    { duration: '10s', target: 5 },     // спад
    { duration: '30s', target: 0 },     // cool down
  ],
  thresholds: {
    http_req_failed: ['rate<0.20'],     // допускаємо до 20% помилок при spike
  },
};

export default function () {
  const r = http.get(`${BASE}/catalog`);
  errorRate.add(r.status !== 200);
  check(r, { 'status ok': (r) => r.status === 200 });
  sleep(Math.random() * 1 + 0.3);
}
