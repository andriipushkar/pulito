import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getUserById,
  updateUserRole,
  updateUserProfile,
  toggleBlockUser,
  resetUserPassword,
  updateAdminNote,
  getUserOrders,
  getUserStats,
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

export const GET = withRole('admin', 'manager')(async (request: NextRequest, { params, user: adminUser }) => {
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

export const PUT = withRole('admin')(async (request: NextRequest, { params, user: adminUser }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const adminId = adminUser!.id;

    const action = body.action;

    if (action === 'block' || action === 'unblock') {
      const user = await toggleBlockUser(numId, action === 'block', body.reason, adminId);
      return successResponse(user);
    }

    if (action === 'resetPassword') {
      const result = await resetUserPassword(numId, adminId);
      return successResponse(result);
    }

    if (action === 'saveNote') {
      const user = await updateAdminNote(numId, body.note || '');
      return successResponse(user);
    }

    if (action === 'editProfile') {
      const user = await updateUserProfile(numId, {
        fullName: body.fullName,
        phone: body.phone,
        email: body.email,
        companyName: body.companyName,
        edrpou: body.edrpou,
        legalAddress: body.legalAddress,
      }, adminId);
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
      return successResponse(result);
    }

    if (action === 'deleteAccount') {
      const result = await deleteUserAccount(numId, adminId);
      return successResponse(result);
    }

    if (body.role) {
      const user = await updateUserRole(numId, body.role, adminId);
      return successResponse(user);
    }

    if (body.wholesaleGroup !== undefined) {
      const { prisma } = await import('@/lib/prisma');
      const group = body.wholesaleGroup === null ? null : Number(body.wholesaleGroup);
      if (group !== null && ![1, 2, 3].includes(group)) {
        return errorResponse('Оптова група має бути 1, 2 або 3', 400);
      }
      await prisma.user.update({ where: { id: numId }, data: { wholesaleGroup: group } });
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
