import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { gtinValidationError } from '@/utils/gtin';

export const PATCH = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params }) => {
  try {
    const { variantId } = await params!;
    const numId = Number(variantId);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = (await request.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof body.sku === 'string') data.sku = body.sku.trim();
    if (typeof body.name === 'string') data.name = body.name.trim();
    if ('barcode' in body) {
      const raw = String(body.barcode ?? '').trim().replace(/\D/g, '');
      if (!raw) {
        data.barcode = null;
      } else {
        const err = gtinValidationError(raw);
        if (err) return errorResponse(err, 400);
        data.barcode = raw;
      }
    }
    if ('priceRetail' in body) {
      data.priceRetail =
        body.priceRetail === null || body.priceRetail === '' ? null : Number(body.priceRetail);
    }
    if ('priceWholesale' in body) {
      data.priceWholesale =
        body.priceWholesale === null || body.priceWholesale === ''
          ? null
          : Number(body.priceWholesale);
    }
    if ('quantity' in body) data.quantity = Number(body.quantity);
    if ('options' in body) data.options = body.options as object | null;
    if ('isActive' in body) data.isActive = Boolean(body.isActive);
    if ('sortOrder' in body) data.sortOrder = Number(body.sortOrder);
    if ('weightGrams' in body) {
      data.weightGrams =
        body.weightGrams === null || body.weightGrams === '' ? null : Number(body.weightGrams);
    }
    if ('cost' in body) {
      data.cost = body.cost === null || body.cost === '' ? null : Number(body.cost);
    }

    const updated = await prisma.productVariant.update({ where: { id: numId }, data });
    return successResponse(updated);
  } catch (error) {
    console.error('[Variant PATCH]', error);
    return errorResponse('Помилка оновлення', 500);
  }
});

export const DELETE = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { variantId } = await params!;
    const numId = Number(variantId);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    await prisma.productVariant.delete({ where: { id: numId } });
    return successResponse({ ok: true });
  } catch (error) {
    console.error('[Variant DELETE]', error);
    return errorResponse('Помилка видалення', 500);
  }
});
