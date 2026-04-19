import React from 'react';
import { vi, beforeEach } from 'vitest';

// Env defaults must be set BEFORE any module imports happen so that config/env.ts
// (imported transitively by many services) validates against them. `process.env`
// mutations here run at setup time, which is before the test file's own imports.
const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6380/0',
  JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  APP_URL: 'http://localhost:3000',
  APP_SECRET: 'test-app-secret-minimum-32-chars!!',
};
for (const [k, v] of Object.entries(TEST_ENV)) {
  if (!process.env[k]) process.env[k] = v;
}

// Re-stub before every test so individual tests can override without persisting.
beforeEach(() => {
  for (const [k, v] of Object.entries(TEST_ENV)) {
    vi.stubEnv(k, v);
  }
});

// Global mock for next/image — render a plain <img> in tests so existing
// `container.querySelector('img[src="/foo.jpg"]')` assertions keep working
// regardless of Next.js 16 Image component internals.
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => React.createElement('img', props),
}));

// next/link — plain <a> so href-based assertions match.
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...rest
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) =>
    React.createElement('a', { href, ...rest }, children),
}));
