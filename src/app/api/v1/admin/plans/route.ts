import { successResponse, errorResponse } from '@/utils/api-response';
import { getPlans } from '@/services/billing';

export async function GET() {
  try {
    const plans = await getPlans();
    return successResponse(plans);
  } catch {
    return errorResponse('Помилка завантаження планів', 500);
  }
}
