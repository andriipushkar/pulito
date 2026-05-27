import { withRole } from '@/middleware/auth';
import { detectAnomalies } from '@/services/anomaly';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const anomalies = await detectAnomalies();
    return successResponse({ anomalies });
  } catch {
    return errorResponse('Не вдалося порахувати аномалії', 500);
  }
});
