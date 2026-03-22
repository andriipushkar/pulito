import { NextRequest } from 'next/server';
import { getPostBySlug, getRelatedPosts } from '@/services/blog';
import { successResponse, errorResponse } from '@/utils/api-response';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const post = await getPostBySlug(slug);

    if (!post) {
      return errorResponse('Статтю не знайдено', 404);
    }

    const related = await getRelatedPosts(post.id);

    return successResponse({ ...post, related });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
}
