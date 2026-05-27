import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  const u = await prisma.user.findFirst({
    where: {
      OR: [{ email: { contains: 'smdshrek' } }, { fullName: { contains: 'smdshrek' } }],
    },
    select: { id: true, email: true, role: true, fullName: true, twoFactorEnabled: true },
  });
  if (!u) {
    console.log('Користувача smdshrek не знайдено');
    process.exit(1);
  }
  console.log('Знайдено:', {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    prev2fa: u.twoFactorEnabled,
  });

  await prisma.user.update({
    where: { id: u.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    },
  });
  console.log(`✅ 2FA скинуто для user.id=${u.id} (${u.email})`);
  await prisma.$disconnect();
})();
