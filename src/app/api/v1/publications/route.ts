import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
    const limit = Math.min(50, Math.max(1, Math.floor(Number(searchParams.get('limit')) || 12)));

    // Push the `channels @> ["site"]` predicate to Postgres instead of pulling
    // every published row into the Node process and filtering in JS — that
    // pattern OOM'd as soon as the table grew past a few thousand rows.
    const where = {
      status: 'published' as const,
      publishedAt: { not: null },
      channels: { array_contains: ['site'] },
    };

    const [total, publications] = await Promise.all([
      prisma.publication.count({ where }),
      prisma.publication.findMany({
        where,
        select: {
          id: true,
          title: true,
          content: true,
          imagePath: true,
          hashtags: true,
          publishedAt: true,
          product: {
            select: { id: true, name: true, slug: true },
          },
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return successResponse({
      publications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
