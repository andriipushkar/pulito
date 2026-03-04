import { NextRequest } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { notifyManagerFeedback } from '@/services/telegram';

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
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { wholesaleStatus: true, role: true },
  });

  if (!current) return errorResponse('Користувача не знайдено', 404);
  if (current.role === 'wholesaler') return errorResponse('Ви вже оптовий клієнт', 400);
  if (current.wholesaleStatus === 'pending') return errorResponse('Заявка вже подана і очікує розгляду', 400);

  const body = await request.json();
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
  } = body;

  if (!companyName?.trim()) return errorResponse('Вкажіть назву компанії', 400);
  if (!contactPersonName?.trim()) return errorResponse('Вкажіть контактну особу', 400);
  if (!contactPersonPhone?.trim()) return errorResponse('Вкажіть телефон контактної особи', 400);

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

  // Notify managers via Telegram
  try {
    const msgLines = [
      `Заявка на оптового клієнта`,
      `🏢 ${companyName}`,
      edrpou ? `ЄДРПОУ: ${edrpou}` : '',
      wholesaleMonthlyVol ? `📦 Обсяг: ${wholesaleMonthlyVol}` : '',
      comment || '',
    ].filter(Boolean).join('\n');

    await notifyManagerFeedback({
      type: 'form',
      name: contactPersonName,
      phone: contactPersonPhone,
      email: user.email,
      subject: 'Заявка на оптового клієнта',
      message: msgLines,
    });
  } catch { /* non-critical */ }

  return successResponse(updated);
});
