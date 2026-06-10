import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isBlocked: true,
      passwordHash: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  for (const u of admins) {
    console.log({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      isBlocked: u.isBlocked,
      hashPrefix: u.passwordHash ? u.passwordHash.substring(0, 10) : null,
      hashLen: u.passwordHash?.length,
      updatedAt: u.updatedAt,
    });
  }

  console.log('--- recent password_reset audit logs ---');
  const logs = await prisma.auditLog.findMany({
    where: { actionType: 'password_reset' },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  for (const l of logs) console.log(l);

  await prisma.$disconnect();
})();
