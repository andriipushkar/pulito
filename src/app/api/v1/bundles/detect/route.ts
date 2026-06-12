import { NextRequest } from 'next/server';
import { z } from 'zod';
import { detectBundleDiscounts } from '@/services/bundle';
import { successResponse, errorResponse } from '@/utils/api-response';

const detectSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        price: z.number().nonnegative(),
        quantity: z.number().int().positive().max(9999),
      }),
    )
    .max(200),
});

/**
 * Прев'ю бандл-знижки для кошика/чекаута. Ціни приходять з клієнта, тож це
 * ЛИШЕ відображення — createOrder детектить комплекти заново зі своїми цінами,
 * клієнтське значення на сервері ніде не використовується.
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = detectSchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse('Невалідні дані кошика', 422);

    const { totalDiscount, applied } = await detectBundleDiscounts(parsed.data.items);
    return successResponse({ totalDiscount, applied });
  } catch {
    return errorResponse('Помилка сервера', 500);
  }
}
