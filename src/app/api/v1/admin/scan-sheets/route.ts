import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import {
  getScanSheetList,
  insertDocumentsToScanSheet,
  deleteScanSheet,
  NovaPoshtaError,
} from '@/services/nova-poshta';
import { successResponse, errorResponse } from '@/utils/api-response';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { logAudit } from '@/services/audit';

// List all registries (реєстри) from the NP cabinet.
export const GET = withRole(
  'admin',
  'manager',
)(async () => {
  try {
    const list = await getScanSheetList();
    return successResponse(list);
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/scan-sheets] GET failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

const createSchema = z.object({
  orderIds: z.array(z.number().int().positive()).min(1, 'Оберіть замовлення').max(100),
  date: z
    .string()
    .regex(/^\d{2}\.\d{2}\.\d{4}$/, 'Дата у форматі dd.mm.yyyy')
    .optional(),
  scanSheetRef: z.string().optional(),
});

// Group orders' TTNs into a registry. Orders need a stored trackingRef
// (TTN created via the API) — manual numbers can't be registered.
export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { user }) => {
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: parsed.data.orderIds } },
      select: { id: true, trackingRef: true, trackingNumber: true },
    });
    const refs = orders.map((o) => o.trackingRef).filter((r): r is string => !!r);
    const skipped = orders.filter((o) => !o.trackingRef).length;

    if (refs.length === 0) {
      return errorResponse(
        'У жодного з обраних замовлень немає Ref (ТТН створено вручну?). Реєстр неможливий.',
        400,
      );
    }

    const result = await insertDocumentsToScanSheet({
      documentRefs: refs,
      date: parsed.data.date,
      scanSheetRef: parsed.data.scanSheetRef,
    });

    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'order',
      details: {
        scope: 'scan_sheet_insert',
        scanSheet: result.number,
        count: refs.length,
        skipped,
      },
    });

    return successResponse({ ...result, added: refs.length, skipped }, 201);
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/scan-sheets] POST failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

const deleteSchema = z.object({
  refs: z.array(z.string().min(1)).min(1, 'Вкажіть реєстри для видалення'),
});

// Disband one or more registries.
export const DELETE = withRole('admin')(async (request: NextRequest, { user }) => {
  try {
    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }
    await deleteScanSheet(parsed.data.refs);
    await logAudit({
      userId: user.id,
      actionType: 'data_update',
      entityType: 'order',
      details: { scope: 'scan_sheet_delete', count: parsed.data.refs.length },
    });
    return successResponse({ deleted: parsed.data.refs.length });
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/scan-sheets] DELETE failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
