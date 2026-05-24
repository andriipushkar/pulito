import { NextRequest } from 'next/server';
import { withRole2fa } from '@/middleware/auth';
import {
  getUserById,
  updateUserRole,
  updateUserProfile,
  toggleBlockUser,
  resetUserPassword,
  updateAdminNote,
  getUserOrders,
  getUserStats,
  getUserTimeline,
  getUserAuditLog,
  verifyUserEmail,
  sendMessageToUser,
  getUserWishlist,
  getUserRecentlyViewed,
  getUserAddresses,
  exportUserData,
  deleteUserAccount,
  UserError,
} from '@/services/user';
import { successResponse, errorResponse } from '@/utils/api-response';
import { filterByRole, filterArrayByRole } from '@/utils/role-filter';
import { getClientIp } from '@/utils/request';
import { logAudit } from '@/services/audit';

export const GET = withRole2fa(
  'admin',
  'manager',
)(async (request: NextRequest, { params, user: adminUser }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const role = adminUser!.role as 'admin' | 'manager';
    const section = request.nextUrl.searchParams.get('section');

    if (section === 'orders') {
      const orders = await getUserOrders(numId);
      return successResponse(orders);
    }
    if (section === 'stats') {
      const stats = await getUserStats(numId);
      return successResponse(stats);
    }
    if (section === 'timeline') {
      const timeline = await getUserTimeline(numId);
      return successResponse(timeline);
    }
    if (section === 'audit') {
      const logs = await getUserAuditLog(numId);
      const filtered = filterArrayByRole(logs as Record<string, unknown>[], role);
      return successResponse(filtered);
    }
    if (section === 'wishlist') {
      const items = await getUserWishlist(numId);
      return successResponse(items);
    }
    if (section === 'recent') {
      const items = await getUserRecentlyViewed(numId);
      return successResponse(items);
    }
    if (section === 'addresses') {
      const addresses = await getUserAddresses(numId);
      return successResponse(addresses);
    }
    if (section === 'export') {
      const data = await exportUserData(numId);
      const filtered = filterByRole(data as Record<string, unknown>, role);
      return successResponse(filtered);
    }

    const user = await getUserById(numId);
    if (!user) {
      return errorResponse('Користувача не знайдено', 404);
    }
    const filtered = filterByRole(user as Record<string, unknown>, role);
    return successResponse(filtered);
  } catch (error) {
    if (error instanceof UserError) {
      return errorResponse(error.message, error.statusCode);
    }
    console.error('[Admin User GET]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const PUT = withRole2fa('admin')(async (
  request: NextRequest,
  { params, user: adminUser },
) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const adminId = adminUser!.id;

    const action = body.action;

    const ipAddress = getClientIp(request);

    if (action === 'block' || action === 'unblock') {
      const user = await toggleBlockUser(numId, action === 'block', body.reason, adminId, {
        ipAddress,
      });
      return successResponse(user);
    }

    if (action === 'resetPassword') {
      const result = await resetUserPassword(numId, adminId, { ipAddress });
      return successResponse(result);
    }

    if (action === 'saveNote') {
      const user = await updateAdminNote(numId, body.note || '');
      await logAudit({
        userId: adminId,
        actionType: 'data_update',
        entityType: 'user',
        entityId: numId,
        details: { field: 'adminNote', length: (body.note || '').length },
        ipAddress,
      });
      return successResponse(user);
    }

    if (action === 'editProfile') {
      const user = await updateUserProfile(
        numId,
        {
          fullName: body.fullName,
          phone: body.phone,
          email: body.email,
          companyName: body.companyName,
          edrpou: body.edrpou,
          legalAddress: body.legalAddress,
        },
        adminId,
      );
      return successResponse(user);
    }

    if (action === 'verifyEmail') {
      const result = await verifyUserEmail(numId, adminId);
      return successResponse(result);
    }

    if (action === 'sendMessage') {
      if (!body.message || !body.channels?.length) {
        return errorResponse('Вкажіть повідомлення та канали відправки', 400);
      }
      const result = await sendMessageToUser(numId, body.message, body.channels, body.subject);
      await logAudit({
        userId: adminId,
        actionType: 'data_create',
        entityType: 'user_message',
        entityId: numId,
        details: {
          channels: body.channels,
          subject: body.subject ?? null,
          length: body.message.length,
        },
        ipAddress,
      });
      return successResponse(result);
    }

    if (action === 'deleteAccount') {
      const result = await deleteUserAccount(numId, adminId, { ipAddress });
      return successResponse(result);
    }

    if (body.role) {
      const group =
        body.wholesaleGroup === undefined
          ? undefined
          : body.wholesaleGroup === null
            ? null
            : Number(body.wholesaleGroup);
      const user = await updateUserRole(numId, body.role, adminId, group);
      return successResponse(user);
    }

    if (body.wholesaleGroup !== undefined) {
      const { prisma } = await import('@/lib/prisma');
      const group = body.wholesaleGroup === null ? null : Number(body.wholesaleGroup);
      if (group !== null && ![1, 2, 3].includes(group)) {
        return errorResponse('Гуртова група має бути 1, 2 або 3', 400);
      }
      const prev = await prisma.user.findUnique({
        where: { id: numId },
        select: { wholesaleGroup: true },
      });
      await prisma.user.update({ where: { id: numId }, data: { wholesaleGroup: group } });
      await logAudit({
        userId: adminId,
        actionType: 'data_update',
        entityType: 'user',
        entityId: numId,
        details: { field: 'wholesaleGroup', before: prev?.wholesaleGroup ?? null, after: group },
        ipAddress,
      });
      const user = await getUserById(numId);
      return successResponse(user);
    }

    return errorResponse('Не вказано дію для виконання', 400);
  } catch (error) {
    if (error instanceof UserError) {
      return errorResponse(error.message, error.statusCode);
    }
    console.error('[Admin User Update]', error);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
