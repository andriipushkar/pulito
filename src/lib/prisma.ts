import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // Pool size tuned for a cheap VPS (1-2 GB RAM).
  // PgBouncer handles connection multiplexing in production;
  // the app-side pool is kept small to avoid exhausting server memory.
  const poolMax = Number(process.env.DATABASE_POOL_MAX) || 5;
  const poolMin = Number(process.env.DATABASE_POOL_MIN) || 1;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: poolMax,
    min: poolMin,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
