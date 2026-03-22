import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { createBundleSchema } from '@/validators/bundle';
import { createBundle, BundleError } from '@/services/bundle';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from '@/utils/api-response';

export const GET = withRole('manager', 'admin')(async (request: NextRequest) => {
  try {
    const { page, limit, search } = parseSearchParams(request.nextUrl.searchParams);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [bundles, total] = await Promise.all([
      prisma.bundle.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, slug: true, priceRetail: true, imagePath: true },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bundle.count({ where }),
    ]);

    return paginatedResponse(bundles, total, page, limit);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withRole('manager', 'admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createBundleSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }

    const bundle = await createBundle(parsed.data, user.id);
    return successResponse(bundle, 201);
  } catch (error) {
    if (error instanceof BundleError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
