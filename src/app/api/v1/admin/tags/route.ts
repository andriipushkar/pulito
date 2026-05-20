import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

export const GET = withRole('admin', 'manager')(async () => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { entities: true } } },
    });
    return successResponse(tags);
  } catch (error) {
    console.error('[Tags GET]', error);
    return errorResponse('Помилка', 500);
  }
});

export const POST = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const body = (await request.json()) as { name?: unknown; color?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const color = typeof body.color === 'string' ? body.color : null;
    if (!name) return errorResponse('Назва обов\'язкова', 400);
    const slug = slugify(name);
    if (!slug) return errorResponse('Неможливо побудувати slug з назви', 400);
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: { name, ...(color !== null ? { color } : {}) },
      create: { name, slug, color },
    });
    return successResponse(tag, 201);
  } catch (error) {
    console.error('[Tags POST]', error);
    return errorResponse('Помилка', 500);
  }
});
