'use server';

import { addToCart, clearCart, mergeCart } from '@/services/cart';
import { addToCartSchema } from '@/validators/order';
import { verifyAccessToken } from '@/services/token';
import { isAccessTokenBlacklisted } from '@/services/auth';
import { checkActionRateLimit, ACTION_LIMITS } from '@/lib/action-rate-limit';
import { cookies } from 'next/headers';
import { z } from 'zod';

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;

  try {
    const payload = verifyAccessToken(token);
    const blacklisted = await isAccessTokenBlacklisted(token);
    if (blacklisted) return null;
    return { id: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export async function addToCartAction(
  _prevState: { success: boolean; error?: string },
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const rateLimitError = await checkActionRateLimit(ACTION_LIMITS.cart);
  if (rateLimitError) {
    return { success: false, error: rateLimitError };
  }

  const user = await getAuthUser();
  if (!user) {
    return { success: false, error: 'Необхідно авторизуватися' };
  }

  const raw = {
    productId: Number(formData.get('productId')),
    quantity: Number(formData.get('quantity') || 1),
  };

  const parsed = addToCartSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  try {
    await addToCart(user.id, parsed.data.productId, parsed.data.quantity);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Помилка додавання в кошик';
    return { success: false, error: message };
  }
}

export async function clearCartAction(): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser();
  if (!user) {
    return { success: false, error: 'Необхідно авторизуватися' };
  }

  try {
    await clearCart(user.id);
    return { success: true };
  } catch {
    return { success: false, error: 'Помилка очищення кошика' };
  }
}

const mergeCartSchema = z.array(
  z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1),
  })
);

export async function mergeCartAction(
  items: { productId: number; quantity: number }[]
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser();
  if (!user) {
    return { success: false, error: 'Необхідно авторизуватися' };
  }

  const parsed = mergeCartSchema.safeParse(items);
  if (!parsed.success) {
    return { success: false, error: 'Невалідні дані кошика' };
  }

  try {
    await mergeCart(user.id, parsed.data);
    return { success: true };
  } catch {
    return { success: false, error: 'Помилка синхронізації кошика' };
  }
}
