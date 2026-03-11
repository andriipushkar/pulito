import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { sendProductPhotoToUser as sendTelegramPhoto } from '@/services/telegram';
import { sendProductPhotoToUser as sendViberPhoto } from '@/services/viber';

const sendPhotoSchema = z.object({
  productId: z.number().int().positive(),
  message: z.string().max(500).optional(),
});

export const POST = withRole('admin', 'manager')(
  async (request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const orderId = Number(id);
      if (isNaN(orderId)) return errorResponse('Невалідний ID', 400);

      const body = await request.json();
      const parsed = sendPhotoSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0].message, 422);
      }

      const { productId, message } = parsed.data;

      // Get order with user
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, orderNumber: true, userId: true },
      });
      if (!order) return errorResponse('Замовлення не знайдено', 404);
      if (!order.userId) return errorResponse('Замовлення не прив\'язане до користувача', 400);

      // Get product with image
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          code: true,
          imagePath: true,
          images: {
            select: { pathFull: true },
            where: { isMain: true },
            take: 1,
          },
        },
      });
      if (!product) return errorResponse('Товар не знайдено', 404);

      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const imagePath = product.images[0]?.pathFull || product.imagePath;
      if (!imagePath) return errorResponse('Товар не має зображення', 400);

      const imageUrl = `${appUrl}${imagePath}`;
      const caption = message
        ? `${product.name}\n${message}`
        : `${product.name}\nКод: ${product.code}`;

      // Send via both channels (whichever the user has linked)
      const [telegramSent, viberSent] = await Promise.all([
        sendTelegramPhoto(order.userId, imageUrl, caption),
        sendViberPhoto(order.userId, imageUrl, caption),
      ]);

      if (!telegramSent && !viberSent) {
        return errorResponse('Користувач не має прив\'язаних месенджерів', 400);
      }

      // Log as order comment
      const channels = [telegramSent && 'Telegram', viberSent && 'Viber'].filter(Boolean).join(', ');
      await prisma.order.update({
        where: { id: order.id },
        data: {
          managerComment: `Фото товару "${product.name}" відправлено клієнту (${channels})${message ? `: ${message}` : ''}`,
        },
      });

      return successResponse({ telegramSent, viberSent, channels });
    } catch {
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
