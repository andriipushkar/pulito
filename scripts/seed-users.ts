import 'dotenv/config';
import { hash } from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = 'Test1234!';
  const passwordHash = await hash(password, 10);

  const users = [
    {
      email: 'admin@pulito.trade',
      fullName: 'Адміністратор',
      role: 'admin' as const,
      phone: '+380501111111',
      wholesaleStatus: 'none' as const,
      wholesaleGroup: null,
    },
    {
      email: 'manager@pulito.trade',
      fullName: 'Менеджер',
      role: 'manager' as const,
      phone: '+380502222222',
      wholesaleStatus: 'none' as const,
      wholesaleGroup: null,
    },
    {
      email: 'client@pulito.trade',
      fullName: 'Роздрібний клієнт',
      role: 'client' as const,
      phone: '+380503333333',
      wholesaleStatus: 'none' as const,
      wholesaleGroup: null,
    },
    {
      email: 'wholesale1@pulito.trade',
      fullName: 'Оптовий клієнт (група 1)',
      role: 'wholesaler' as const,
      phone: '+380504444444',
      wholesaleStatus: 'approved' as const,
      wholesaleGroup: 1,
    },
    {
      email: 'wholesale2@pulito.trade',
      fullName: 'Оптовий клієнт (група 2)',
      role: 'wholesaler' as const,
      phone: '+380505555555',
      wholesaleStatus: 'approved' as const,
      wholesaleGroup: 2,
    },
    {
      email: 'wholesale3@pulito.trade',
      fullName: 'Оптовий клієнт (група 3)',
      role: 'wholesaler' as const,
      phone: '+380506666666',
      wholesaleStatus: 'approved' as const,
      wholesaleGroup: 3,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash,
        role: u.role,
        fullName: u.fullName,
        phone: u.phone,
        wholesaleStatus: u.wholesaleStatus,
        wholesaleGroup: u.wholesaleGroup,
        isVerified: true,
      },
      create: {
        email: u.email,
        passwordHash,
        role: u.role,
        fullName: u.fullName,
        phone: u.phone,
        wholesaleStatus: u.wholesaleStatus,
        wholesaleGroup: u.wholesaleGroup,
        isVerified: true,
      },
    });
    console.log('OK: ' + u.email + ' (' + u.role + ')');
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
