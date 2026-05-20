import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { createShipmentSchema } from '@/validators/ukrposhta';
import { createShipment, UkrposhtaError } from '@/services/ukrposhta';
import { logger } from '@/lib/logger';

export const POST = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createShipmentSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      return errorResponse(`Невалідні дані: ${JSON.stringify(errors)}`, 400);
    }

    const shipment = await createShipment(parsed.data);

    return successResponse(shipment, 201);
  } catch (error) {
    if (error instanceof UkrposhtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/ukrposhta/shipment] POST failed', { error });
    return errorResponse('Помилка створення відправлення', 500);
  }
});
