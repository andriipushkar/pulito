import { prisma } from '@/lib/prisma';
import { signAccessToken } from '@/services/token';
import { logAudit } from '@/services/audit';

export class ImpersonationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ImpersonationError';
  }
}

/**
 * Mint a short-lived access token where `sub` is the target user and
 * `impersonatedBy` is the acting admin. The admin's refresh token cookie is
 * left intact — when the impersonation access token expires the page will
 * silently refresh back into the admin's normal session.
 *
 * Refuses to impersonate other admins (too easy to confuse audit trails).
 * Logs the action so every impersonated request can later be cross-referenced
 * to the real human who initiated it.
 */
export async function startImpersonation(
  adminId: number,
  targetUserId: number,
  ipAddress?: string,
): Promise<{ accessToken: string; user: { id: number; email: string; fullName: string } }> {
  if (adminId === targetUserId) {
    throw new ImpersonationError('Не можна імперсонувати самого себе');
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, fullName: true, role: true, isBlocked: true },
  });
  if (!target) throw new ImpersonationError('Користувача не знайдено', 404);
  if (target.isBlocked) {
    throw new ImpersonationError('Не можна імперсонувати заблокованого користувача');
  }
  if (target.role === 'admin' || target.role === 'manager') {
    throw new ImpersonationError(
      'Імперсонація іншого адміністратора чи менеджера заборонена',
      403,
    );
  }

  const accessToken = signAccessToken({
    sub: target.id,
    email: target.email,
    role: target.role,
    impersonatedBy: adminId,
  });

  await logAudit({
    userId: adminId,
    actionType: 'impersonate_start',
    entityType: 'user',
    entityId: target.id,
    details: { targetEmail: target.email },
    ipAddress,
  });

  return {
    accessToken,
    user: { id: target.id, email: target.email, fullName: target.fullName },
  };
}
