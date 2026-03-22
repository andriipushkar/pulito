import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const banners = await prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        title: true,
        subtitle: true,
        imageDesktop: true,
        imageMobile: true,
        buttonText: true,
        buttonLink: true,
      },
    });
    return successResponse(banners);
  } catch {
    return errorResponse('Помилка завантаження банерів', 500);
  }
}
