import { getCheckoutConfig } from '@/services/checkout-config';
import { successResponse } from '@/utils/api-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  return successResponse(await getCheckoutConfig());
}
