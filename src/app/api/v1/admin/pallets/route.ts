import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { listPallets, createPallet, PalletError } from '@/services/pallet';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  region: z.string().max(100).optional().nullable(),
  carrier: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const GET = withRole(
  'manager',
  'admin',
)(async (request: NextRequest) => {
  try {
    const status = request.nextUrl.searchParams.get('status') ?? undefined;
    const pallets = await listPallets({ status });
    return successResponse(pallets);
  } catch (err) {
    logger.error('[admin/pallets] GET failed', { error: err });
    return errorResponse('Помилка завантаження', 500);
  }
});

export const POST = withRole(
  'manager',
  'admin',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const pallet = await createPallet({ ...parsed.data, createdBy: user.id });
    return successResponse(pallet, 201);
  } catch (err) {
    if (err instanceof PalletError) return errorResponse(err.message, err.statusCode);
    logger.error('[admin/pallets] POST failed', { error: err });
    return errorResponse('Не вдалося створити палету', 500);
  }
});
