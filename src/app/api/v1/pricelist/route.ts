import { NextRequest, NextResponse } from 'next/server';
import { withOptionalAuth } from '@/middleware/auth';
import { generatePricelist, PricelistError } from '@/services/pricelist';
import { errorResponse } from '@/utils/api-response';

export const GET = withOptionalAuth(async (request: NextRequest, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type !== 'retail' && type !== 'wholesale') {
      return errorResponse('Параметр type має бути retail або wholesale', 400);
    }

    // Wholesale pricelist requires wholesaler or manager role
    if (type === 'wholesale') {
      if (!user) {
        return errorResponse('Для гуртового прайс-листа потрібна авторизація', 401);
      }
      if (user.role !== 'wholesaler' && user.role !== 'manager' && user.role !== 'admin') {
        return errorResponse('Недостатньо прав для гуртового прайс-листа', 403);
      }
    }

    const buffer = await generatePricelist(type);

    const filename = type === 'wholesale' ? 'pricelist_wholesale.pdf' : 'pricelist_retail.pdf';

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    if (error instanceof PricelistError) {
      return errorResponse(error.message, error.statusCode);
    }
    return errorResponse('Помилка генерації прайс-листа', 500);
  }
});
