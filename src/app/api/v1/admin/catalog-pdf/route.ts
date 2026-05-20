import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { generatePriceList, generateIllustratedCatalog, PdfCatalogError } from '@/services/pdf-catalog';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const POST = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const { type, priceType, categoryId, promoOnly } = body;

      let url: string;

      if (type === 'pricelist') {
        url = await generatePriceList({
          type: priceType || 'retail',
          categoryId: categoryId ? Number(categoryId) : undefined,
        });
      } else if (type === 'illustrated') {
        url = await generateIllustratedCatalog({
          categoryId: categoryId ? Number(categoryId) : undefined,
          promoOnly: promoOnly || false,
        });
      } else {
        return errorResponse('Тип: pricelist або illustrated', 400);
      }

      return successResponse({ url }, 201);
    } catch (error) {
      if (error instanceof PdfCatalogError) {
        return errorResponse(error.message, error.statusCode);
      }
      logger.error('[admin/catalog-pdf] POST failed', { error });
      return errorResponse('Помилка генерації PDF', 500);
    }
  }
);
