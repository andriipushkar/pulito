import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const password = 'Test1234!';
const hash = bcrypt.hashSync(password, 12);

const users = [
  { email: 'admin2@test.ua', fullName: 'Петренко Сергій', role: 'admin' as const, phone: '+380501110001' },
  { email: 'manager2@test.ua', fullName: 'Коваленко Наталія', role: 'manager' as const, phone: '+380501110002' },
  { email: 'manager3@test.ua', fullName: 'Бондаренко Максим', role: 'manager' as const, phone: '+380501110003' },
  { email: 'wholesale2@test.ua', fullName: 'ТОВ Чистий Дім', role: 'wholesaler' as const, phone: '+380501110004', companyName: 'ТОВ Чистий Дім', edrpou: '12345678', wholesaleGroup: 1 },
  { email: 'wholesale3@test.ua', fullName: 'ФОП Мельник О.В.', role: 'wholesaler' as const, phone: '+380501110005', companyName: 'ФОП Мельник О.В.', edrpou: '87654321', wholesaleGroup: 2 },
  { email: 'wholesale4@test.ua', fullName: 'ТОВ Побут Сервіс', role: 'wholesaler' as const, phone: '+380501110006', companyName: 'ТОВ Побут Сервіс', edrpou: '11223344', wholesaleGroup: 3 },
  { email: 'client2@test.ua', fullName: 'Шевченко Ольга', role: 'client' as const, phone: '+380501110007' },
  { email: 'client3@test.ua', fullName: 'Ткаченко Андрій', role: 'client' as const, phone: '+380501110008' },
  { email: 'client4@test.ua', fullName: 'Кравченко Марія', role: 'client' as const, phone: '+380501110009' },
  { email: 'client5@test.ua', fullName: 'Іваненко Дмитро', role: 'client' as const, phone: '+380501110010' },
  { email: 'blocked@test.ua', fullName: 'Заблокований Юзер', role: 'client' as const, phone: '+380501110011' },
];

async function main() {
  let created = 0;
  for (const u of users) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (exists) { console.log('Існує: ' + u.email); continue; }
    
    await prisma.user.create({
      data: {
        email: u.email,
        fullName: u.fullName,
        passwordHash: hash,
        role: u.role,
        phone: u.phone || null,
        isVerified: true,
        companyName: u.companyName || null,
        edrpou: u.edrpou || null,
        wholesaleGroup: u.wholesaleGroup || null,
        wholesaleStatus: u.wholesaleGroup ? 'approved' : 'none',
        isBlocked: u.email === 'blocked@test.ua',
        blockedReason: u.email === 'blocked@test.ua' ? 'Тестовий заблокований акаунт' : null,
        referralCode: 'REF' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      },
    });
    created++;
    console.log('✅ ' + u.email + ' | ' + u.role + ' | ' + u.fullName);
  }
  
  console.log('\nСтворено: ' + created);
  const total = await prisma.user.count();
  console.log('Всього юзерів: ' + total);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); });
