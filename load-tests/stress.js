/**
 * Stress Test — знаходить точку відмови сервера.
 * Поступово збільшує до 100 юзерів. Для $5 VPS (1-2GB RAM)
 * сервер зазвичай починає деградувати при 30-50 конкурентних.
 *
 * Запуск: k6 run load-tests/stress.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '1m', target: 25 },
    { duration: '1m', target: 50 },
    { duration: '2m', target: 75 },
    { duration: '2m', target: 100 },   // пікове навантаження
    { duration: '1m', target: 50 },    // ramp down
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.15'],
  },
};

export default function () {
  const pages = [
    `${BASE}/`,
    `${BASE}/catalog`,
    `${BASE}/catalog?page=2`,
    `${BASE}/faq`,
  ];

  const url = pages[Math.floor(Math.random() * pages.length)];
  const r = http.get(url);
  errorRate.add(r.status !== 200);
  check(r, {
    'status 200': (r) => r.status === 200,
    'duration < 5s': (r) => r.timings.duration < 5000,
  });

  sleep(Math.random() * 2 + 0.5);
}
