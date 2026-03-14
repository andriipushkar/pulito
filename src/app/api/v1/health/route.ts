import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import fs from 'fs/promises';
import os from 'os';

interface CheckResult {
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}

async function measureLatency<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
  const start = performance.now();
  const result = await fn();
  return { result, latencyMs: Math.round(performance.now() - start) };
}

export async function GET() {
  const checks: Record<string, CheckResult> = {};

  // Database check with latency
  try {
    const { latencyMs } = await measureLatency(() => prisma.$queryRaw`SELECT 1`);
    checks.database = { status: 'ok', latencyMs };
  } catch (err) {
    checks.database = { status: 'error', error: err instanceof Error ? err.message : 'Unknown' };
  }

  // Redis check with latency
  try {
    const { latencyMs } = await measureLatency(() => redis.ping());
    checks.redis = { status: 'ok', latencyMs };
  } catch (err) {
    checks.redis = { status: 'error', error: err instanceof Error ? err.message : 'Unknown' };
  }

  // Disk space check
  try {
    const stats = await fs.statfs(process.cwd());
    const totalGb = (stats.bsize * stats.blocks) / (1024 ** 3);
    const freeGb = (stats.bsize * stats.bavail) / (1024 ** 3);
    const usedPercent = Math.round(((totalGb - freeGb) / totalGb) * 100);
    checks.disk = {
      status: usedPercent > 90 ? 'error' : 'ok',
      ...(usedPercent > 90 && { error: `${usedPercent}% used` }),
    };
  } catch {
    checks.disk = { status: 'error', error: 'Cannot read disk stats' };
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok');
  const uptimeSeconds = Math.round(process.uptime());

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: uptimeSeconds,
      memory: {
        rss: Math.round(process.memoryUsage.rss() / (1024 * 1024)),
        heapUsed: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
      },
      loadAvg: os.loadavg().map((v) => Math.round(v * 100) / 100),
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
