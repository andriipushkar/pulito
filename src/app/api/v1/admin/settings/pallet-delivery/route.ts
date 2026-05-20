import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import { getPalletConfig, updatePalletConfig, PalletDeliveryError } from '@/services/pallet-delivery';
import { palletConfigSchema } from '@/validators/pallet-delivery';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

export const GET = withRole2fa('admin')(async () => {
  try {
    const config = await getPalletConfig();
    return successResponse(config);
  } catch (err) {
    logger.error('[admin/settings/pallet-delivery] GET failed', { error: err });
    return errorResponse('Помилка завантаження конфігурації', 500);
  }
});

export const PUT = withRole2fa('admin')(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = palletConfigSchema.partial().safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невірні дані', 400);
    }

    const config = await updatePalletConfig(parsed.data, user.id);
    return successResponse(config);
  } catch (error) {
    if (error instanceof PalletDeliveryError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/settings/pallet-delivery] PUT failed', { error });
    return errorResponse('Помилка збереження конфігурації', 500);
  }
});
