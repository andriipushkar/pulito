import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/services/email';
import { successResponse, errorResponse } from '@/utils/api-response';
import { sanitizeHtml } from '@/utils/sanitize';

export const POST = withRole('admin')(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const template = await prisma.emailTemplate.findUnique({ where: { id: numId } });
    if (!template) return errorResponse('Шаблон не знайдено', 404);

    const body = await request.json();
    const { email, subject, bodyHtml } = body;

    if (!email) return errorResponse('Email обов\'язковий', 400);

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

    return successResponse({ sent: true });
  } catch (error) {
    console.error('[Email Template Test]', error);
    const message = error instanceof Error ? error.message : 'Помилка відправки';
    return errorResponse(message, 500);
  }
});
