import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const REPORT_TYPES = [
  'dashboard_summary',
  'sales_summary',
  'products_stock',
  'orders_by_status',
  'clients_activity',
  'wholesale_report',
  'delivery_report',
  'financial_report',
] as const;

const SCHEDULES = ['daily', 'weekly', 'monthly'] as const;

const subscribeSchema = z.object({
  reportType: z.enum(REPORT_TYPES),
  schedule: z.enum(SCHEDULES),
  email: z.string().email().optional(),
});

export const GET = withRole(
  'admin',
  'manager',
)(async (_request: NextRequest, { user }) => {
  try {
    const subscriptions = await prisma.reportTemplate.findMany({
      where: { createdBy: user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reportType: true,
        schedule: true,
        scheduleEmail: true,
        createdAt: true,
      },
    });
    return successResponse(subscriptions);
  } catch (err) {
    logger.error('[admin/reports/subscriptions] GET failed', { error: err });
    return errorResponse('Не вдалося завантажити підписки', 500);
  }
});

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const body = await request.json();
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }
    const { reportType, schedule, email } = parsed.data;

    // Resolve the recipient email — fallback to the admin's own login email
    // so they don't need to retype it each time.
    let recipientEmail = email;
    if (!recipientEmail) {
      const me = await prisma.user.findUnique({
        where: { id: user.id },
        select: { email: true },
      });
      recipientEmail = me?.email ?? undefined;
    }
    if (!recipientEmail) {
      return errorResponse('Email не знайдено', 422);
    }

    // Upsert: if the user already subscribed to this report+schedule, just
    // update the email; otherwise create a fresh row.
    const existing = await prisma.reportTemplate.findFirst({
      where: { createdBy: user.id, reportType, schedule, isActive: true },
    });
    const saved = existing
      ? await prisma.reportTemplate.update({
          where: { id: existing.id },
          data: { scheduleEmail: recipientEmail },
        })
      : await prisma.reportTemplate.create({
          data: {
            name: `${reportType} · ${schedule}`,
            createdBy: user.id,
            reportType,
            schedule,
            scheduleEmail: recipientEmail,
            isActive: true,
          },
        });
    return successResponse(saved, existing ? 200 : 201);
  } catch (err) {
    logger.error('[admin/reports/subscriptions] POST failed', { error: err });
    return errorResponse('Не вдалося зберегти підписку', 500);
  }
});

