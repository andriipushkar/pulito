import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { cacheInvalidate } from '@/services/cache';
import { invalidateSettingsCache } from '@/services/settings';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { logger } from '@/lib/logger';

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: ['maintenance_mode', 'maintenance_message'] } },
      select: { key: true, value: true },
    });
    const byKey = new Map(settings.map((s) => [s.key, s.value]));
    return successResponse({
      enabled: byKey.get('maintenance_mode') === 'true',
      message: byKey.get('maintenance_message') || '',
    });
  } catch (err) {
    logger.error('[admin/maintenance GET] failed', { error: err });
    return errorResponse('Помилка', 500);
  }
});

export const PUT = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const { enabled, message } = await request.json();

    await prisma.siteSetting.upsert({
      where: { key: 'maintenance_mode' },
      update: { value: String(!!enabled), updatedBy: user.id },
      create: { key: 'maintenance_mode', value: String(!!enabled), updatedBy: user.id },
    });

    if (message !== undefined) {
      await prisma.siteSetting.upsert({
        where: { key: 'maintenance_message' },
        update: { value: message, updatedBy: user.id },
        create: { key: 'maintenance_message', value: message, updatedBy: user.id },
      });
    }

    await cacheInvalidate('maintenance:*');
    // maintenance_mode lives in the shared site-settings cache ('site:settings'),
    // which the old 'settings:*' glob never matched — proxy kept reading a stale
    // flag. invalidateSettingsCache() clears both the Redis entry and the
    // in-memory copy so the toggle takes effect within the cache TTL.
    await invalidateSettingsCache();

    await logAudit({
      userId: user.id,
      actionType: 'rule_change',
      entityType: 'settings',
      details: { scope: 'maintenance', enabled: !!enabled, messageProvided: message !== undefined },
      ipAddress: getClientIp(request),
    });

    return successResponse({ enabled: !!enabled });
  } catch (err) {
    logger.error('[admin/maintenance PUT] failed', { error: err });
    return errorResponse('Помилка', 500);
  }
});
