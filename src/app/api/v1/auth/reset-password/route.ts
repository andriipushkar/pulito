import { NextRequest } from 'next/server';
import { z } from 'zod';
import { resetPassword } from '@/services/verification';
import { AuthError } from '@/services/auth-errors';
import { successResponse, errorResponse } from '@/utils/api-response';
import { passwordSchema } from '@/validators/auth';

const schema = z.object({
  token: z.string().min(1, 'Токен обов\'язковий'),
  password: passwordSchema,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    await resetPassword(parsed.data.token, parsed.data.password);
    return successResponse({ message: 'Пароль успішно змінено. Увійдіть з новим паролем.' });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
