import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Mapping: [source ID, source name, target ID, target name]
const migrations: [number, string, number, string][] = [
  [30, "Morning Fresh apple плин для миття посуду 900 мл", 24, "Засоби для миття та чищення"],
  [31, "Гелі для прання", 26, "Засоби для прання"],
  [32, "Порошки для прання", 26, "Засоби для прання"],
  [33, "Капсули для прання", 26, "Засоби для прання"],
  [34, "Серветки для прання", 26, "Засоби для прання"],
  [35, "Кондиціонери-ополіскувачі для прання", 26, "Засоби для прання"],
  [36, "Плямовивідники", 26, "Засоби для прання"],
  [37, "Засоби для чищення", 24, "Засоби для миття та чищення"],
  [38, "Засоби для гоління", 29, "Засоби гігієни"],
  [39, "Губки, скребки, ганчірки, швабри", 27, "Товари для дому"],
  [40, "Засоби для ротової порожнини", 29, "Засоби гігієни"],
  [41, "Різне", 27, "Товари для дому"],
];

async function main() {
  for (const [srcId, srcName, targetId, targetName] of migrations) {
    const moved = await prisma.product.updateMany({
      where: { categoryId: srcId },
      data: { categoryId: targetId },
    });
    console.log(`✓ ${srcName} (${srcId}) → ${targetName} (${targetId}): ${moved.count} товарів`);
  }

  const srcIds = migrations.map(([id]) => id);
  const deleted = await prisma.category.deleteMany({
    where: { id: { in: srcIds } },
  });
  console.log(`\n✓ Видалено ${deleted.count} зайвих категорій`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
