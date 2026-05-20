import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { generateCommercialOfferPdf, PdfError } from '@/services/pdf';
import { successResponse, errorResponse } from '@/utils/api-response';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const commercialOfferSchema = z.object({
  productIds: z.array(z.number().int().positive()).min(1, 'Оберіть хоча б один товар'),
  clientName: z.string().optional(),
});

export const POST = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const parsed = commercialOfferSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0].message, 422);
      }

      const products = await prisma.product.findMany({
        where: { id: { in: parsed.data.productIds } },
        select: { code: true, name: true, priceRetail: true },
      });

      if (products.length === 0) {
        return errorResponse('Товари не знайдено', 404);
      }

      const items = products.map((p) => ({
        code: p.code,
        name: p.name,
        price: Number(p.priceRetail),
      }));

      const pdfUrl = await generateCommercialOfferPdf(items, parsed.data.clientName);

      return successResponse({ pdfUrl }, 201);
    } catch (error) {
      if (error instanceof PdfError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/commercial-offer] POST failed', { error });
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
