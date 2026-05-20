/**
 * One-shot backfill: fill empty productImage.altText with the product name.
 * Run once after deploying — every new upload now auto-sets altText, so this
 * is only for historical images.
 *
 * Usage:  npx tsx scripts/backfill-image-alt-text.ts
 */
import { prisma } from '../src/lib/prisma';

async function main() {
  const empties = await prisma.productImage.findMany({
    where: {
      OR: [{ altText: null }, { altText: '' }],
    },
    select: {
      id: true,
      sortOrder: true,
      product: { select: { name: true } },
    },
  });

  if (empties.length === 0) {
    console.log('Усі зображення вже мають altText. Нема чого оновлювати.');
    return;
  }

  console.log(`Знайдено ${empties.length} зображень без altText. Оновлюю…`);

  let done = 0;
  for (const img of empties) {
    if (!img.product?.name) continue;
    const altText =
      img.sortOrder > 0
        ? `${img.product.name} — фото ${img.sortOrder + 1}`
        : img.product.name;
    await prisma.productImage.update({
      where: { id: img.id },
      data: { altText },
    });
    done += 1;
    if (done % 50 === 0) console.log(`  …${done}/${empties.length}`);
  }

  console.log(`Готово. Оновлено ${done} зображень.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
