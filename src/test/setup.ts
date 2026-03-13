import { vi, beforeEach } from 'vitest';

// Stub environment variables for all tests
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
  vi.stubEnv('REDIS_URL', 'redis://localhost:6380/0');
  vi.stubEnv('JWT_SECRET', 'test-jwt-secret-minimum-16-chars');
  vi.stubEnv('JWT_ACCESS_TTL', '15m');
  vi.stubEnv('JWT_REFRESH_TTL', '30d');
  vi.stubEnv('APP_URL', 'http://localhost:3000');
  vi.stubEnv('APP_SECRET', 'test-app-secret-minimum-32-chars!!');
});
