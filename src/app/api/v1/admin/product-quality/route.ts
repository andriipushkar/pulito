import { withRole } from '@/middleware/auth';
import { getWorstQualityProducts } from '@/services/product-quality';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const products = await getWorstQualityProducts(10);
    return successResponse({ products });
  } catch {
    return errorResponse('Не вдалося порахувати якість', 500);
  }
});
