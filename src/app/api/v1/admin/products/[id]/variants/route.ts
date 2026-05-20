import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { gtinValidationError } from '@/utils/gtin';

export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const productId = Number(id);
    if (isNaN(productId)) return errorResponse('Невалідний ID', 400);
    const variants = await prisma.productVariant.findMany({
      where: { productId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return successResponse(variants);
  } catch (error) {
    console.error('[Variants GET]', error);
    return errorResponse('Помилка', 500);
  }
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const productId = Number(id);
    if (isNaN(productId)) return errorResponse('Невалідний ID', 400);
    const body = (await request.json()) as Record<string, unknown>;
    const sku = String(body.sku ?? '').trim();
    const name = String(body.name ?? '').trim();
    const barcodeRaw = String(body.barcode ?? '').trim().replace(/\D/g, '');
    if (!sku || !name) return errorResponse('SKU та назва обов\'язкові', 400);
    if (barcodeRaw) {
      const err = gtinValidationError(barcodeRaw);
      if (err) return errorResponse(err, 400);
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        sku,
        ...(barcodeRaw ? { barcode: barcodeRaw } : {}),
        name,
        priceRetail:
          body.priceRetail !== undefined && body.priceRetail !== '' && body.priceRetail !== null
            ? Number(body.priceRetail)
            : null,
        priceWholesale:
          body.priceWholesale !== undefined && body.priceWholesale !== '' && body.priceWholesale !== null
            ? Number(body.priceWholesale)
            : null,
        quantity: Number(body.quantity ?? 0),
        ...(body.options !== undefined && body.options !== null
          ? { options: body.options as object }
          : {}),
        weightGrams:
          body.weightGrams !== undefined && body.weightGrams !== '' && body.weightGrams !== null
            ? Number(body.weightGrams)
            : null,
        cost:
          body.cost !== undefined && body.cost !== '' && body.cost !== null
            ? Number(body.cost)
            : null,
        isActive: body.isActive !== false,
        sortOrder: Number(body.sortOrder ?? 0),
      },
    });
    return successResponse(variant, 201);
  } catch (error) {
    console.error('[Variants POST]', error);
    return errorResponse('Помилка створення варіанта', 500);
  }
});
