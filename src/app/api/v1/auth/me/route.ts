import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth';
import { getUserById } from '@/services/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { passwordSchema } from '@/validators/auth';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export const GET = withAuth(async (_request, { user }) => {
  const fullUser = await getUserById(user.id);

  if (!fullUser) {
    return errorResponse('Користувача не знайдено', 404);
  }

  // Personal profile data must never sit on a shared CDN/proxy cache.
  const res = successResponse({ user: fullUser });
  res.headers.set('Cache-Control', 'no-store');
  return res;
});

const profileSchema = z.object({
  fullName: z
    .string()
    .min(2, "Ім'я має бути мінімум 2 символи")
    .max(100, "Ім'я має бути максимум 100 символів")
    .optional(),
  phone: z
    .string()
    .regex(/^\+380\d{9}$/, 'Невірний формат телефону')
    .optional()
    .or(z.literal('')),
});

const passwordChangeSchema = z.object({
  newPassword: passwordSchema,
});

const SALT_ROUNDS = 10;

export const PUT = withAuth(async (request, { user }) => {
  const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.sensitive);
  if (!rl.allowed) return errorResponse('Забагато змін профілю. Спробуйте пізніше.', 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Невалідне тіло запиту', 400);
  }

  if (!body || typeof body !== 'object') {
    return errorResponse('Невалідне тіло запиту', 400);
  }

  const payload = body as Record<string, unknown>;
  const wantsPasswordChange = typeof payload.newPassword === 'string';

  if (wantsPasswordChange) {
    const parsed = passwordChangeSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    const newHash = await bcrypt.hash(parsed.data.newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    await logAudit({
      userId: user.id,
      actionType: 'password_reset',
      entityType: 'user',
      entityId: user.id,
      details: { source: dbUser?.passwordHash ? 'self_change' : 'self_set_initial' },
      ipAddress: getClientIp(request),
    }).catch(() => {
      /* audit failure must not break user op */
    });

    const res = successResponse({ updated: true });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const parsed = profileSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
  }

  const data: { fullName?: string; phone?: string | null } = {};
  if (parsed.data.fullName !== undefined) data.fullName = parsed.data.fullName;
  if (parsed.data.phone !== undefined)
    data.phone = parsed.data.phone === '' ? null : parsed.data.phone;

  if (Object.keys(data).length === 0) {
    return errorResponse('Немає полів для оновлення', 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data,
  });

  await logAudit({
    userId: user.id,
    actionType: 'user_edit',
    entityType: 'user',
    entityId: user.id,
    details: { source: 'self_update', fields: Object.keys(data) },
    ipAddress: getClientIp(request),
  }).catch(() => {
    /* audit failure must not break user op */
  });

  const updated = await getUserById(user.id);
  const res = successResponse({ user: updated });
  res.headers.set('Cache-Control', 'no-store');
  return res;
});
