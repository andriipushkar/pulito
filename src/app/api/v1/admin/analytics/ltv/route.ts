import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { getCustomerLTV } from '@/services/analytics-reports';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';
import { parseDays } from '@/utils/analytics-days';
import { maskEmail } from '@/utils/pii';

export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const days = parseDays(request.nextUrl.searchParams.get('days'), 365);
    const data = await getCustomerLTV(days);

    // Manager-role sees masked PII. LTV top-N tables identify customers by
    // name+email — the full identity isn't required for the rolling-trend
    // analysis a manager runs, only admins need the contact lookup. The
    // unmasked aggregate stats (count, total) remain useful for everyone.
    if (user.role !== 'admin') {
      type Customer = {
        userId: number;
        email?: string;
        fullName?: string;
        companyName?: string | null;
        [k: string]: unknown;
      };
      const masked = data as { topCustomers?: Customer[] };
      if (masked.topCustomers) {
        masked.topCustomers = masked.topCustomers.map((c) => ({
          ...c,
          email: maskEmail(c.email) ?? '',
          fullName: c.fullName
            ? c.fullName
                .split(' ')
                .map((p, i) => (i === 0 ? p : p[0] + '.'))
                .join(' ')
            : '',
          companyName: c.companyName ? c.companyName.slice(0, 3) + '••••' : null,
        }));
      }
    }

    return successResponse(data);
  } catch (err) {
    logger.error('[admin/analytics/ltv] GET failed', { error: err });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
