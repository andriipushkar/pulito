import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { parseQuickOrderInput, resolveQuickOrder, QuickOrderError } from '@/services/quick-order';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, errorResponse } from '@/utils/api-response';

const MAX_INPUT_BYTES = 64 * 1024; // ~64KB covers ~2k well-formed lines
const MAX_LINES = 500;

export const POST = withRole(
  'wholesaler',
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.wholesale);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const body = await request.json();
    const { input } = body;

    if (!input || typeof input !== 'string') {
      return errorResponse('Введіть список товарів (код — кількість)', 400);
    }

    // Cap raw input size up-front — parseQuickOrderInput splits by newline,
    // so without this a 10MB blob would explode into millions of "lines"
    // and hit Prisma with a giant `IN ()` clause.
    if (Buffer.byteLength(input, 'utf-8') > MAX_INPUT_BYTES) {
      return errorResponse('Список занадто великий (максимум 64KB)', 413);
    }

    const parsed = parseQuickOrderInput(input);
    if (parsed.length === 0) {
      return errorResponse('Не розпізнано жодного рядка. Формат: код кількість', 400);
    }
    const lines = parsed.slice(0, MAX_LINES);

    const resolved = await resolveQuickOrder(lines);
    return successResponse(resolved);
  } catch (error) {
    if (error instanceof QuickOrderError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка обробки замовлення', 500);
  }
});
