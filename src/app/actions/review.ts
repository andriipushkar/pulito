'use server';

import { createReview, markReviewHelpful } from '@/services/review';
import { createReviewSchema } from '@/validators/review';
import { verifyAccessToken } from '@/services/token';
import { isAccessTokenBlacklisted } from '@/services/auth';
import { cookies } from 'next/headers';

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

export async function submitReviewAction(
  _prevState: { success: boolean; error?: string },
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser();
  if (!user) {
    return { success: false, error: 'Необхідно авторизуватися' };
  }

  const raw = {
    productId: Number(formData.get('productId')),
    rating: Number(formData.get('rating')),
    title: formData.get('title') as string || undefined,
    comment: formData.get('comment') as string || undefined,
    pros: formData.get('pros') as string || undefined,
    cons: formData.get('cons') as string || undefined,
  };

  const parsed = createReviewSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Невалідні дані' };
  }

  try {
    await createReview({ ...parsed.data, userId: user.id });
    return { success: true };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return { success: false, error: 'Ви вже залишали відгук на цей товар' };
    }
    return { success: false, error: 'Помилка при надсиланні відгуку' };
  }
}

export async function markHelpfulAction(
  reviewId: number
): Promise<{ success: boolean; error?: string }> {
  if (!reviewId || reviewId <= 0) {
    return { success: false, error: 'Невірний ID відгуку' };
  }

  try {
    await markReviewHelpful(reviewId);
    return { success: true };
  } catch {
    return { success: false, error: 'Помилка сервера' };
  }
}
