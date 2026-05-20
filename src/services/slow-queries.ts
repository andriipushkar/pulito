import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Surface the slowest queries from pg_stat_statements. Requires the extension
 * to be enabled on the database (`CREATE EXTENSION IF NOT EXISTS pg_stat_statements;`).
 * If unavailable, returns an empty array with an explanatory note that the UI
 * can render.
 */

export interface SlowQueryRow {
  query: string;
  calls: number;
  meanMs: number;
  totalMs: number;
  rows: number;
}

export interface SlowQueryResult {
  rows: SlowQueryRow[];
  available: boolean;
  hint?: string;
}

export async function getSlowQueries(limit = 10): Promise<SlowQueryResult> {
  try {
    const raw = await prisma.$queryRawUnsafe<
      Array<{
        query: string;
        calls: bigint;
        mean_exec_time: number;
        total_exec_time: number;
        rows: bigint;
      }>
    >(
      `SELECT query, calls, mean_exec_time, total_exec_time, rows
       FROM pg_stat_statements
       WHERE query NOT LIKE '%pg_stat_statements%'
       ORDER BY mean_exec_time DESC
       LIMIT ${limit}`,
    );

    return {
      available: true,
      rows: raw.map((r) => ({
        query: r.query.length > 240 ? r.query.slice(0, 240) + '…' : r.query,
        calls: Number(r.calls),
        meanMs: Math.round(r.mean_exec_time * 100) / 100,
        totalMs: Math.round(r.total_exec_time),
        rows: Number(r.rows),
      })),
    };
  } catch (err) {
    logger.warn('[slow-queries] pg_stat_statements unavailable', { error: String(err) });
    return {
      available: false,
      rows: [],
      hint:
        'Розширення pg_stat_statements не активоване. ' +
        'Виконайте на БД: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;',
    };
  }
}
