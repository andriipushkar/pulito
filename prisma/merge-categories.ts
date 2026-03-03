import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Merging all categories into 6 main categories...\n');

  // New category IDs (from previous script)
  const PRANNYA = 26;      // Засоби для прання
  const MYTTYA = 24;       // Засоби для миття та чищення
  const HIHIYENA = 29;     // Засоби гігієни
  const DIM = 27;          // Товари для дому
  const TILO = 25;         // Догляд за тілом
  const VOLOSYA = 28;      // Догляд за волоссям

  // Mapping: old category ID → new category ID
  const mergeMap: Record<number, number> = {
    10: MYTTYA,     // Morning Fresh apple... → Засоби для миття та чищення
    11: PRANNYA,    // Гелі для прання → Засоби для прання
    12: PRANNYA,    // Порошки для прання → Засоби для прання
    13: PRANNYA,    // Капсули для прання → Засоби для прання
    14: PRANNYA,    // Серветки для прання → Засоби для прання
    15: PRANNYA,    // Кондиціонери-ополіскувачі → Засоби для прання
    16: PRANNYA,    // Плямовивідники → Засоби для прання
    17: MYTTYA,     // Засоби для чищення → Засоби для миття та чищення
    18: TILO,       // Догляд за тілом (old) → Догляд за тілом (new)
    19: TILO,       // Засоби для гоління → Догляд за тілом
    20: VOLOSYA,    // Догляд за волоссям (old) → Догляд за волоссям (new)
    21: DIM,        // Губки, скребки, ганчірки → Товари для дому
    22: HIHIYENA,   // Засоби для ротової порожнини → Засоби гігієни
    23: DIM,        // Різне → Товари для дому
  };

  // Move products from old categories to new ones
  for (const [oldId, newId] of Object.entries(mergeMap)) {
    const result = await prisma.product.updateMany({
      where: { categoryId: Number(oldId) },
      data: { categoryId: newId },
    });
    if (result.count > 0) {
      const oldCat = await prisma.category.findUnique({ where: { id: Number(oldId) } });
      const newCat = await prisma.category.findUnique({ where: { id: newId } });
      console.log(`  ${oldCat?.name} (${result.count} товарів) → ${newCat?.name}`);
    }
  }

  // Delete old categories
  const oldIds = Object.keys(mergeMap).map(Number);
  for (const id of oldIds) {
    try {
      await prisma.category.delete({ where: { id } });
    } catch {
      // Already deleted or has remaining references
    }
  }
  console.log(`\nDeleted ${oldIds.length} old categories`);

  // Final summary
  const finalCategories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { sortOrder: 'asc' },
  });
  console.log('\n--- Фінальні категорії ---');
  let total = 0;
  for (const cat of finalCategories) {
    console.log(`  ${cat.name}: ${cat._count.products} товарів`);
    total += cat._count.products;
  }
  console.log(`\nУсього товарів: ${total}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
