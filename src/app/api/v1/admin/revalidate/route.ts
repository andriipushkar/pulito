import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';

/**
 * POST /api/v1/admin/revalidate
 * Triggers on-demand revalidation of cached pages.
 * Called automatically when products/categories are updated in admin.
 */
export const POST = withRole('admin', 'manager')(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const { paths, tags, type } = body;

      const revalidated: string[] = [];

      // Revalidate specific paths
      if (paths && Array.isArray(paths)) {
        for (const path of paths) {
          revalidatePath(path);
          revalidated.push(`path:${path}`);
        }
      }

      // Revalidate by tag (path-based fallback)
      if (tags && Array.isArray(tags)) {
        for (const tag of tags) {
          // Use path revalidation as fallback
          revalidatePath(`/${tag}`);
          revalidated.push(`tag:${tag}`);
        }
      }

      // Shortcut: revalidate common pages by type
      if (type === 'product') {
        revalidatePath('/');
        revalidatePath('/catalog');
        if (body.slug) revalidatePath(`/product/${body.slug}`);
        revalidated.push('homepage', 'catalog', body.slug ? `product/${body.slug}` : '');
      } else if (type === 'category') {
        revalidatePath('/');
        revalidatePath('/catalog');
        revalidated.push('homepage', 'catalog');
      } else if (type === 'all') {
        revalidatePath('/', 'layout');
        revalidated.push('all');
      }

      return successResponse({ revalidated });
    } catch {
      return errorResponse('Помилка ревалідації', 500);
    }
  }
);
