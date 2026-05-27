/**
 * One-shot backfill: fill empty productImage.altText using the same logic the
 * runtime uploader uses (generateAutoAltText) — including category-specific
 * altTemplate from seo_templates when configured. Falls back to the legacy
 * "<name> — фото N" pattern otherwise.
 *
 * Usage:  npx tsx scripts/backfill-image-alt-text.ts
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { generateAutoAltText } from '../src/services/image';

async function main() {
  const empties = await prisma.productImage.findMany({
    where: {
      OR: [{ altText: null }, { altText: '' }],
    },
    select: {
      id: true,
      sortOrder: true,
      product: {
        select: {
          name: true,
          code: true,
          priceRetail: true,
          category: { select: { id: true, name: true } },
        },
      },
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
    const altText = await generateAutoAltText({
      name: img.product.name,
      code: img.product.code,
      category: img.product.category?.name ?? '',
      categoryId: img.product.category?.id,
      price: Number(img.product.priceRetail).toFixed(2),
      photoNumber: img.sortOrder + 1,
    });
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
