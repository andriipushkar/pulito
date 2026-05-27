import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth';
import {
  saveSearch,
  getSearchHistory,
  clearSearchHistory,
  deleteSearchEntry,
  getRecentUniqueQueries,
} from '@/services/search-history';
import {
  successResponse,
  privateResponse,
  privatePaginatedResponse,
  errorResponse,
  parseSearchParams,
} from '@/utils/api-response';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

const saveSchema = z.object({
  // Search input field; 200 chars covers any realistic query while
  // stopping a 10 MB body from landing in user_search_history.
  query: z.string().min(1).max(200),
  resultsCount: z.number().int().min(0).max(1_000_000).optional(),
});

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const unique = request.nextUrl.searchParams.get('unique');

    // Для випадаючого списку: повертаємо останні 5 унікальних запитів
    if (unique === 'true') {
      const limit = Math.min(
        10,
        Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 5),
      );
      const items = await getRecentUniqueQueries(user.id, limit);
      return privateResponse(items);
    }

    // Стандартна пагінація для повної історії
    const { page, limit } = parseSearchParams(request.nextUrl.searchParams);
    const { items, total } = await getSearchHistory(user.id, page, limit);
    return privatePaginatedResponse(items, total, page, limit);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    // Rate-limit so a scripted client can't flood user_search_history.
    // `search` bucket (30/min) covers real autocomplete chatter.
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.search);
    if (!rl.allowed) {
      return errorResponse('Забагато запитів. Спробуйте пізніше.', 429);
    }

    const body = await request.json();
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const trimmed = parsed.data.query.trim();
    if (trimmed.length === 0) {
      return errorResponse('query не може бути порожнім', 400);
    }
    const entry = await saveSearch(user.id, trimmed, parsed.data.resultsCount ?? 0);
    return successResponse(entry, 201);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withAuth(async (request: NextRequest, { user }) => {
  try {
    const id = request.nextUrl.searchParams.get('id');

    // Видалення окремого запису
    if (id) {
      const entryId = Number(id);
      if (isNaN(entryId)) {
        return errorResponse('Невалідний id', 400);
      }
      await deleteSearchEntry(entryId, user.id);
      return successResponse({ message: 'Запис видалено' });
    }

    // Очищення всієї історії
    await clearSearchHistory(user.id);
    return successResponse({ message: 'Історію пошуку очищено' });
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
