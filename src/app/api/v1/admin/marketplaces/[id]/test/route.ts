import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getChannelConfig,
  testChannelConnection,
  type ChannelType,
  type MarketplaceConfig,
} from '@/services/channel-config';
import {
  isMarketplacePlatform,
  type HealthCheckResult,
} from '@/services/marketplace-health';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const MASK_MARKER = '••';

function unmaskConfig(
  input: Record<string, unknown>,
  stored: MarketplaceConfig | null,
): MarketplaceConfig {
  const result: Record<string, unknown> = { ...(stored || {}) };
  for (const [key, value] of Object.entries(input)) {
    // If value is a masked string and we have a stored value, keep stored
    if (typeof value === 'string' && value.includes(MASK_MARKER) && stored?.[key] !== undefined) {
      continue;
    }
    result[key] = value;
  }
  return result as MarketplaceConfig;
}

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    if (!isMarketplacePlatform(id)) {
      return errorResponse('Невідома платформа', 400);
    }

    const body = await request.json().catch(() => ({}));
    const inputConfig = (body as { config?: Record<string, unknown> }).config;

    const stored = (await getChannelConfig(id)) as MarketplaceConfig | null;
    const config: MarketplaceConfig = inputConfig
      ? unmaskConfig(inputConfig, stored)
      : stored ?? ({ enabled: false } as MarketplaceConfig);

    const startedAt = Date.now();
    const ping = await testChannelConnection(id as ChannelType, config);

    const result: HealthCheckResult = {
      status: ping.success ? 'ok' : 'error',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      accountName: ping.name,
      error: ping.success ? undefined : ping.error || 'Невідома помилка',
    };

    // Persist health result so the next page load reflects it
    const key = `marketplace_health_${id}`;
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(result) },
      update: { value: JSON.stringify(result) },
    });

    return successResponse(result);
  } catch (error) {
    logger.error('[admin/marketplaces/[id]/test] POST failed', { error });
    const message = error instanceof Error ? error.message : 'Помилка тестування';
    return errorResponse(message, 500);
  }
});
