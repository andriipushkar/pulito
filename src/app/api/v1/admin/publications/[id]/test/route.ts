import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const schema = z.object({
  channel: z.string().min(1).max(50),
});

/**
 * POST — render the publication content for ONE channel without actually
 * dispatching it. Useful for "Did my Mustache placeholders fill in?" before
 * burning a real publish slot on Telegram.
 *
 * Implementation: re-use the same `getContentForChannel` + `resolveTemplateVars`
 * pipeline the real publisher uses, return the rendered text. We don't import
 * those helpers (they're private to publication.ts) — instead we fetch and
 * compute inline because we only need the final rendered strings, not the
 * network dispatch.
 */
export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const pub = await prisma.publication.findUnique({
      where: { id: numId },
      select: {
        id: true,
        title: true,
        content: true,
        hashtags: true,
        imagePath: true,
        productId: true,
        channelContents: true,
      },
    });
    if (!pub) return errorResponse('Публікацію не знайдено', 404);

    const channelOverride = parsed.data.channel;
    const cc = (pub.channelContents as Record<string, { title?: string; content?: string; hashtags?: string }> | null);
    const override = cc?.[channelOverride];

    // Resolve {{product.*}} placeholders if a product is linked.
    let productVars: Record<string, string> = {};
    if (pub.productId) {
      const product = await prisma.product.findUnique({
        where: { id: pub.productId },
        select: {
          name: true,
          slug: true,
          code: true,
          priceRetail: true,
          priceRetailOld: true,
        },
      });
      if (product) {
        const appUrl = process.env.APP_URL || 'https://pulito.trade';
        const discount =
          product.priceRetailOld && Number(product.priceRetailOld) > Number(product.priceRetail)
            ? `${Math.round((1 - Number(product.priceRetail) / Number(product.priceRetailOld)) * 100)}%`
            : '';
        productVars = {
          'product.name': product.name,
          'product.code': product.code,
          'product.url': `${appUrl}/product/${product.slug}`,
          'product.price': `${Number(product.priceRetail).toFixed(2)} ₴`,
          'product.discount': discount,
        };
      }
    }

    const render = (s: string | null | undefined): string => {
      if (!s) return '';
      let out = s;
      for (const [k, v] of Object.entries(productVars)) {
        out = out.replace(new RegExp(`\\{\\{?\\s*${k.replace('.', '\\.')}\\s*\\}\\}?`, 'g'), v);
      }
      return out;
    };

    return successResponse({
      channel: channelOverride,
      title: render(override?.title || pub.title),
      content: render(override?.content || pub.content),
      hashtags: render(override?.hashtags || pub.hashtags),
      imagePath: pub.imagePath,
      note: 'Це попередній перегляд — публікацію НЕ надіслано. Натисніть "Опублікувати" для реальної відправки.',
    });
  } catch (err) {
    logger.error('[admin/publications/[id]/test] POST failed', { error: err });
    return errorResponse('Помилка тестового рендеру', 500);
  }
});
