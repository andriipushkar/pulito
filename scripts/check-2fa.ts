import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { generateTOTP } from '../src/services/totp';

(async () => {
  const u = await prisma.user.findFirst({
    where: {
      OR: [{ email: { contains: 'smdshrek' } }, { fullName: { contains: 'smdshrek' } }],
    },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
      isBlocked: true,
    },
  });
  if (!u) {
    console.log('NOT FOUND');
    process.exit(0);
  }
  console.log('id:', u.id);
  console.log('email:', u.email);
  console.log('fullName:', u.fullName);
  console.log('role:', u.role);
  console.log('isBlocked:', u.isBlocked);
  console.log('twoFactorEnabled:', u.twoFactorEnabled);
  console.log('secret len:', u.twoFactorSecret?.length);
  console.log('secret base32?', u.twoFactorSecret ? /^[A-Z2-7]+$/.test(u.twoFactorSecret) : null);
  console.log('backup codes:', u.twoFactorBackupCodes?.length || 0);
  if (u.twoFactorSecret) {
    try {
      const now = generateTOTP(u.twoFactorSecret);
      console.log('current TOTP (this server):', now);
    } catch (e) {
      console.log('TOTP gen error:', (e as Error).message);
    }
  }
  await prisma.$disconnect();
})();
