import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth';
import { getUserById } from '@/services/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { passwordSchema } from '@/validators/auth';

export const GET = withAuth(async (_request, { user }) => {
  const fullUser = await getUserById(user.id);

  if (!fullUser) {
    return errorResponse('Користувача не знайдено', 404);
  }

  return successResponse({ user: fullUser });
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
  currentPassword: z.string().min(1, 'Поточний пароль обовʼязковий'),
  newPassword: passwordSchema,
});

const SALT_ROUNDS = 10;

export const PUT = withAuth(async (request, { user }) => {
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
  const wantsPasswordChange =
    typeof payload.newPassword === 'string' || typeof payload.currentPassword === 'string';

  if (wantsPasswordChange) {
    const parsed = passwordChangeSchema.safeParse(payload);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 400);
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!dbUser?.passwordHash) {
      return errorResponse(
        'Для цього акаунту не встановлено пароль. Скористайтесь відновленням пароля.',
        400,
      );
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, dbUser.passwordHash);
    if (!valid) {
      return errorResponse('Поточний пароль невірний', 401);
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return successResponse({ updated: true });
  }

  const parsed = profileSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 400);
  }

  const data: { fullName?: string; phone?: string | null } = {};
  if (parsed.data.fullName !== undefined) data.fullName = parsed.data.fullName;
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone === '' ? null : parsed.data.phone;

  if (Object.keys(data).length === 0) {
    return errorResponse('Немає полів для оновлення', 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data,
  });

  const updated = await getUserById(user.id);
  return successResponse({ user: updated });
});
