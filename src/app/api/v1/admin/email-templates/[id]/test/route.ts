import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/services/email';
import { successResponse, errorResponse } from '@/utils/api-response';
import { sanitizeHtml } from '@/utils/sanitize';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

const testSchema = z.object({
  email: z.string().email('Невалідний email').max(255),
  subject: z.string().max(300).optional(),
  bodyHtml: z.string().max(200_000).optional(),
});

export const POST = withRole('admin')(async (request: NextRequest, { params, user }) => {
  try {
    // Real outbound emails go to admin-supplied addresses — without a cap a
    // stuck UI button (or stolen session) can blast test mail at an unrelated
    // recipient. Reuse adminPaymentTest (5/min per admin).
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.adminPaymentTest);
    if (!rl.allowed) {
      return errorResponse(`Забагато тестових надсилань. Зачекайте ${rl.retryAfter}с.`, 429);
    }

    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const template = await prisma.emailTemplate.findUnique({ where: { id: numId } });
    if (!template) return errorResponse('Шаблон не знайдено', 404);

    const body = await request.json();
    const parsed = testSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
    }
    const { email, subject, bodyHtml } = parsed.data;

    // Use provided subject/body (from editor) or fall back to saved template.
    // Sanitize bodyHtml — even though it comes from an authenticated admin,
    // the live editor lets them paste anything, and a hijacked session could
    // smuggle <script> into the test recipient's inbox.
    const finalSubject = subject || template.subject;
    let finalBody = bodyHtml ? sanitizeHtml(String(bodyHtml)) : template.bodyHtml;

    // Replace variables with test data
    const testVars: Record<string, string> = {
      name: 'Тестовий Користувач',
      orderNumber: 'TEST-0001',
      status: 'Підтверджено',
      link: '#',
      amount: '1 234.00 ₴',
      email,
    };

    for (const [key, value] of Object.entries(testVars)) {
      const placeholder = new RegExp(`\\{\\{?${key}\\}\\}?`, 'g');
      finalBody = finalBody.replace(placeholder, value);
    }

    await sendEmail({
      to: email,
      subject: `[ТЕСТ] ${finalSubject}`,
      html: finalBody,
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'email_template_test',
      entityId: numId,
      details: { action: 'test', recipient: email },
      ipAddress: getClientIp(request),
    });

    return successResponse({ sent: true });
  } catch (error) {
    console.error('[Email Template Test]', error);
    const message = error instanceof Error ? error.message : 'Помилка відправки';
    return errorResponse(message, 500);
  }
});
