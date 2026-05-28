import { NextRequest, NextResponse } from 'next/server';
import { withOptionalAuth } from '@/middleware/auth';
import { generatePricelist, PricelistError } from '@/services/pricelist';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { errorResponse } from '@/utils/api-response';
import { prisma } from '@/lib/prisma';

export const GET = withOptionalAuth(async (request: NextRequest, { user }) => {
  try {
    // PDF generation is heavy (Chromium spawn + product join). Apply
    // adminPdfExport (50/day) per user when authenticated, fall back to a
    // per-IP cap for anonymous retail callers — either axis stops a stuck
    // loop or scraper exhausting disk space overnight.
    const rlKey = user ? `user:${user.id}` : `ip:${getRequestIp(request)}`;
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.adminPdfExport);
    if (!rl.allowed) return errorResponse('Денний ліміт прайс-листа вичерпано', 429);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type !== 'retail' && type !== 'wholesale') {
      return errorResponse('Параметр type має бути retail або wholesale', 400);
    }

    // Wholesale pricelist requires wholesaler/manager/admin role
    let group: 1 | 2 | 3 | undefined;
    if (type === 'wholesale') {
      if (!user) {
        return errorResponse('Для гуртового прайс-листа потрібна авторизація', 401);
      }
      if (user.role !== 'wholesaler' && user.role !== 'manager' && user.role !== 'admin') {
        return errorResponse('Недостатньо прав для гуртового прайс-листа', 403);
      }
      // Resolve which tier to render: wholesaler is locked to their own tier;
      // manager/admin may pass ?group=1..3 (for previewing client-specific
      // sheets), defaulting to tier 1 when omitted.
      if (user.role === 'wholesaler') {
        // JWT-токен містить лише role/email/id — wholesaleGroup треба тягти
        // з БД, інакше навіть валідний гуртівник отримує 403.
        const row = await prisma.user.findUnique({
          where: { id: user.id },
          select: { wholesaleGroup: true },
        });
        const g = row?.wholesaleGroup as 1 | 2 | 3 | null | undefined;
        if (!g) {
          return errorResponse(
            'У вашого акаунта не призначено гуртову групу. Зверніться до менеджера.',
            403,
          );
        }
        group = g;
      } else {
        const requested = Number(searchParams.get('group'));
        group = [1, 2, 3].includes(requested) ? (requested as 1 | 2 | 3) : 1;
      }
    }

    const buffer = await generatePricelist(type, group);

    const filename =
      type === 'wholesale'
        ? `pricelist_wholesale${group ? '_g' + group : ''}.pdf`
        : 'pricelist_retail.pdf';

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

function getRequestIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
