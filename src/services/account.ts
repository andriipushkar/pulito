import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';

export class AccountError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'AccountError';
  }
}

/**
 * Delete user account with GDPR-compliant data anonymization.
 * Preserves order history with anonymized contact data.
 */
export async function deleteAccount(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) throw new AccountError('Користувача не знайдено', 404);

  const anonEmail = `deleted_${userId}@anonymized.local`;
  const anonName = 'Видалений користувач';

  // Anonymize orders (preserve for accounting)
  await prisma.order.updateMany({
    where: { userId },
    data: {
      contactName: anonName,
      contactPhone: '0000000000',
      contactEmail: anonEmail,
      deliveryAddress: null,
      comment: null,
    },
  });

  // Delete personal data
  await prisma.cartItem.deleteMany({ where: { userId } });
  await prisma.userAddress.deleteMany({ where: { userId } });
  await prisma.userNotification.deleteMany({ where: { userId } });
  await prisma.refreshToken.deleteMany({ where: { userId } });

  // Anonymize user record (soft delete)
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: anonEmail,
      fullName: anonName,
      phone: null,
      passwordHash: null,
      googleId: null,
      avatarUrl: null,
      telegramChatId: null,
      isVerified: false,
      notificationPrefs: Prisma.JsonNull,
    },
  });

  // Blacklist all existing tokens for this user
  const tokens = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null },
  });
  for (const token of tokens) {
    await prisma.refreshToken.update({
      where: { id: token.id },
      data: { revokedAt: new Date() },
    });
  }
}
