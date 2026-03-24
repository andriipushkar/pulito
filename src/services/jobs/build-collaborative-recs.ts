import { buildCollaborativeRecommendations } from '@/services/recommendation';
import { logger } from '@/lib/logger';

/**
 * Cron job: build collaborative filtering recommendations.
 * Analyzes recent order history and computes Jaccard similarity
 * between products based on user co-purchase patterns.
 */
export async function runBuildCollaborativeRecs(): Promise<{
  created: number;
  durationMs: number;
}> {
  const start = Date.now();
  const created = await buildCollaborativeRecommendations();
  const durationMs = Date.now() - start;

  logger.info(`[build-collaborative-recs] Створено ${created} рекомендацій за ${durationMs}ms`, {
    job: 'build-collaborative-recs',
    created,
    durationMs,
  });

  return { created, durationMs };
}
