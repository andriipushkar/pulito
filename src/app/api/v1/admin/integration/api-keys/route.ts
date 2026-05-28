import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole2fa } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { generateApiKey } from '@/middleware/api-key-auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';

const PERMISSION_KEYS = ['products', 'orders', 'stock', 'prices'] as const;

const createKeySchema = z.object({
  name: z.string().min(1, "Назва обов'язкова").max(120),
  permissions: z.record(z.string(), z.boolean()).optional(),
});

export const GET = withRole2fa('admin')(async () => {
  try {
    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        isActive: true,
        permissions: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    return successResponse(keys);
  } catch (err) {
    logger.error('[admin/integration/api-keys] GET failed', { error: err });
    return errorResponse('Не вдалося завантажити ключі', 500);
  }
});

export const POST = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    const perms = Object.fromEntries(
      PERMISSION_KEYS.map((k) => [k, Boolean(parsed.data.permissions?.[k])]),
    );

    // Reject a key with zero permissions. It can't access any 1C endpoint, so
    // pasting it into the ERP silently breaks every sync with a 403 — the admin
    // only finds out when data stops flowing.
    if (!Object.values(perms).some(Boolean)) {
      return errorResponse('Виберіть хоча б один дозвіл для ключа', 422);
    }

    const { rawKey, keyHash, prefix } = generateApiKey();

    const created = await prisma.apiKey.create({
      data: {
        name: parsed.data.name.trim(),
        keyHash,
        prefix,
        permissions: perms,
        isActive: true,
      },
      select: { id: true, name: true, prefix: true },
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_create',
      entityType: 'api_key',
      entityId: created.id,
      // Don't log the prefix — it leaks the `csk_xxxx` generation pattern
      // to anyone with read access to audit log. Name + permissions are
      // enough for forensics; the keyId resolves the rest via apiKey table.
      details: { name: created.name, permissions: perms },
      ipAddress: getClientIp(request),
    });

    return successResponse({ ...created, rawKey }, 201);
  } catch (err) {
    logger.error('[admin/integration/api-keys] POST failed', { error: err });
    return errorResponse('Не вдалося створити ключ', 500);
  }
});
