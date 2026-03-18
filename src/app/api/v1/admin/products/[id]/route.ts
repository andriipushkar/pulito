import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { updateProductSchema } from '@/validators/product';
import { getProductById, updateProduct, deleteProduct, ProductError } from '@/services/product';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('manager', 'admin')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      const product = await getProductById(numId);

      if (!product) {
        return errorResponse('Товар не знайдено', 404);
      }

      return successResponse(product);
    } catch {
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

export const PUT = withRole('manager', 'admin')(
  async (request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      const body = await request.json();
      const parsed = updateProductSchema.safeParse(body);

      if (!parsed.success) {
        const firstError = parsed.error.issues[0]?.message || 'Невалідні дані';
        return errorResponse(firstError, 422);
      }

      const product = await updateProduct(numId, parsed.data);

      // On-demand revalidation: refresh cached product and catalog pages
      try {
        revalidatePath(`/product/${product.slug}`);
        revalidatePath('/catalog');
        revalidatePath('/');
      } catch { /* revalidation is best-effort */ }

      // Update Typesense index
      import('@/services/typesense').then((ts) => ts.indexProduct(numId)).catch(() => {});

      return successResponse(product);
    } catch (error) {
      if (error instanceof ProductError) {
        return errorResponse(error.message, error.statusCode);
      }
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);

export const DELETE = withRole('manager', 'admin')(
  async (_request: NextRequest, { params }) => {
    try {
      const { id } = await params!;
      const numId = Number(id);
      if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
      await deleteProduct(numId);
      return successResponse({ message: 'Товар деактивовано' });
    } catch (error) {
      if (error instanceof ProductError) {
        return errorResponse(error.message, error.statusCode);
      }
      return errorResponse('Внутрішня помилка сервера', 500);
    }
  }
);
