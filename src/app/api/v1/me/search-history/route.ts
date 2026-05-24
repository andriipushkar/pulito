import { NextRequest } from 'next/server';
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
    const { query, resultsCount } = await request.json();
    if (!query || typeof query !== 'string') {
      return errorResponse("query обов'язковий", 400);
    }
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return errorResponse('query не може бути порожнім', 400);
    }
    const entry = await saveSearch(user.id, trimmed, resultsCount || 0);
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
