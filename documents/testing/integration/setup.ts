import { execSync } from 'child_process';

// Set test DB URL
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/clean_shop_test';
process.env.REDIS_URL = 'redis://localhost:6381/0';
process.env.APP_SECRET = 'test-secret-key-for-integration-tests';
process.env.NODE_ENV = 'test';

export async function setupTestDB() {
  // Push schema to test DB (no migrations needed for test)
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'pipe',
  });
}

export async function teardownTestDB() {
  // Cleanup handled by tmpfs - DB is ephemeral
}
