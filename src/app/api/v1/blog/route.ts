import { NextRequest } from 'next/server';
import { getPublishedPosts } from '@/services/blog';
import { paginatedResponse, errorResponse, parseSearchParams } from '@/utils/api-response';

export async function GET(request: NextRequest) {
  try {
    const { page, limit } = parseSearchParams(request.nextUrl.searchParams);
    const categorySlug = request.nextUrl.searchParams.get('category') || undefined;
    const tag = request.nextUrl.searchParams.get('tag') || undefined;

    const { posts, total } = await getPublishedPosts(page, limit, categorySlug, tag);
    return paginatedResponse(posts, total, page, limit);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
