import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { deleteAccount, AccountError } from '@/services/account';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const DELETE = withAuth(async (request: NextRequest, { user }) => {
  let body: { password?: unknown } = {};
  try {
    const raw = await request.text();
    if (raw) body = JSON.parse(raw);
  } catch {
    return errorResponse('Невалідне тіло запиту', 400);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, googleId: true },
  });

  if (!dbUser) {
    return errorResponse('Користувача не знайдено', 404);
  }

  if (dbUser.passwordHash) {
    if (typeof body.password !== 'string' || body.password.length === 0) {
      return errorResponse('Введіть поточний пароль для підтвердження', 400);
    }
    const valid = await bcrypt.compare(body.password, dbUser.passwordHash);
    if (!valid) {
      return errorResponse('Невірний пароль', 401);
    }
  } else if (!dbUser.googleId) {
    return errorResponse(
      'Видалення доступне лише після встановлення пароля або привʼязки соціального входу.',
      400,
    );
  }

  try {
    await deleteAccount(user.id);
    return successResponse({ message: 'Акаунт видалено' });
  } catch (error) {
    if (error instanceof AccountError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
