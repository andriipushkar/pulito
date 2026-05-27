import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { notifyManagerFeedback } from '@/services/telegram';
import { wholesaleRequestSchema } from '@/validators/wholesale-request';
import { logAudit } from '@/services/audit';
import { getClientIp } from '@/utils/request';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export const GET = withAuth(async (_request: NextRequest, { user }) => {
  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      wholesaleStatus: true,
      wholesaleRequestDate: true,
      wholesaleApprovedDate: true,
      companyName: true,
      edrpou: true,
      ownershipType: true,
      taxSystem: true,
      legalAddress: true,
      contactPersonName: true,
      contactPersonPhone: true,
      wholesaleMonthlyVol: true,
    },
  });

  if (!u) return errorResponse('Користувача не знайдено', 404);
  return successResponse(u);
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  // Heavy operation (DB update + Telegram notify). Cap submissions per user
  // — `sensitive` bucket (3 per 15 min) blocks bot spam without obstructing
  // an honest customer re-submission after fixing a typo.
  const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.sensitive);
  if (!rl.allowed) {
    return errorResponse('Забагато спроб. Спробуйте через 15 хв.', 429);
  }

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { wholesaleStatus: true, role: true },
  });

  if (!current) return errorResponse('Користувача не знайдено', 404);
  if (current.role === 'wholesaler') return errorResponse('Ви вже гуртовий клієнт', 400);
  if (current.wholesaleStatus === 'pending')
    return errorResponse('Заявка вже подана і очікує розгляду', 400);

  const body = await request.json();
  const parsed = wholesaleRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || 'Невалідні дані', 422);
  }
  const {
    companyName,
    edrpou,
    ownershipType,
    taxSystem,
    legalAddress,
    contactPersonName,
    contactPersonPhone,
    wholesaleMonthlyVol,
    comment,
  } = parsed.data;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      companyName: companyName.trim(),
      edrpou: edrpou?.trim() || null,
      ownershipType: ownershipType || null,
      taxSystem: taxSystem || null,
      legalAddress: legalAddress?.trim() || null,
      contactPersonName: contactPersonName.trim(),
      contactPersonPhone: contactPersonPhone.trim(),
      wholesaleMonthlyVol: wholesaleMonthlyVol?.trim() || null,
      wholesaleStatus: 'pending',
      wholesaleRequestDate: new Date(),
    },
    select: {
      wholesaleStatus: true,
      wholesaleRequestDate: true,
      companyName: true,
    },
  });

  // Wholesale status flip is financial (unlocks wholesale prices once
  // approved) — audit-log every transition with company + contact context.
  await logAudit({
    userId: user.id,
    actionType: 'user_edit',
    entityType: 'user',
    entityId: user.id,
    details: {
      action: 'wholesale_request_submitted',
      companyName,
      edrpou: edrpou ?? null,
    },
    ipAddress: getClientIp(request),
  });

  // Notify managers via Telegram
  try {
    const msgLines = [
      `Заявка на гуртового клієнта`,
      `🏢 ${companyName}`,
      edrpou ? `ЄДРПОУ: ${edrpou}` : '',
      wholesaleMonthlyVol ? `📦 Обсяг: ${wholesaleMonthlyVol}` : '',
      comment || '',
    ]
      .filter(Boolean)
      .join('\n');

    await notifyManagerFeedback({
      type: 'form',
      name: contactPersonName,
      phone: contactPersonPhone,
      email: user.email,
      subject: 'Заявка на гуртового клієнта',
      message: msgLines,
    });
  } catch {
    /* non-critical */
  }

  return successResponse(updated);
});
