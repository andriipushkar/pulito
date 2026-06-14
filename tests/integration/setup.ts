import { execSync } from 'child_process';

// Set test DB URL
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/pulito_trade_test';
process.env.REDIS_URL = 'redis://localhost:6381/0';
process.env.APP_SECRET = 'test-secret-key-for-integration-tests';
// Auth env required by src/config/env.ts validation (mirrors .env.test).
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production-min-32-chars';
process.env.JWT_ALGORITHM = 'HS256';
(process.env as Record<string, string>).NODE_ENV = 'test';

let pushed = false;
export async function setupTestDB() {
  if (pushed) return;
  // Push schema to the ephemeral test DB. Prisma 7 requires explicit consent
  // for destructive operations when the AI agent runs them — the test DB uses
  // tmpfs (data is intentionally ephemeral) so this is safe here.
  execSync('npx prisma db push --force-reset', {
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'integration-test-reset',
    },
    stdio: 'pipe',
  });
  pushed = true;
}

export async function teardownTestDB() {
  // Cleanup handled by tmpfs - DB is ephemeral
}
