/**
 * EN translation status report — counts how many rows have empty *En fields
 * across each content model, so the owner sees what still needs translating.
 *
 * Usage:
 *   npx tsx scripts/translation-status.ts                # report only
 *   npx tsx scripts/translation-status.ts --copy-uk-to-en  # fill empty *En from uk (placeholder content)
 *
 * The --copy-uk-to-en flag is a stop-gap so /en/* renders SOMETHING instead
 * of blanking — useful for QA. Production should replace these with real
 * translations (GPT batch, Crowdin export, manual). It is idempotent: rows
 * that already have a non-empty *En value are left untouched.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const shouldCopy = process.argv.includes('--copy-uk-to-en');

async function report() {
  const rows: Array<[string, () => Promise<{ total: number; missing: number }>]> = [
    [
      'Product.nameEn',
      async () => {
        const total = await prisma.product.count({ where: { isActive: true } });
        const missing = await prisma.product.count({
          where: { isActive: true, OR: [{ nameEn: null }, { nameEn: '' }] },
        });
        return { total, missing };
      },
    ],
    [
      'ProductContent.fullDescriptionEn',
      async () => {
        const total = await prisma.productContent.count();
        const missing = await prisma.productContent.count({
          where: { OR: [{ fullDescriptionEn: null }, { fullDescriptionEn: '' }] },
        });
        return { total, missing };
      },
    ],
    [
      'Category.nameEn',
      async () => {
        const total = await prisma.category.count({ where: { deletedAt: null } });
        const missing = await prisma.category.count({
          where: { deletedAt: null, OR: [{ nameEn: null }, { nameEn: '' }] },
        });
        return { total, missing };
      },
    ],
    [
      'Brand.nameEn',
      async () => {
        const total = await prisma.brand.count({ where: { deletedAt: null } });
        const missing = await prisma.brand.count({
          where: { deletedAt: null, OR: [{ nameEn: null }, { nameEn: '' }] },
        });
        return { total, missing };
      },
    ],
    [
      'BlogPost.titleEn',
      async () => {
        const total = await prisma.blogPost.count({ where: { deletedAt: null } });
        const missing = await prisma.blogPost.count({
          where: { deletedAt: null, OR: [{ titleEn: null }, { titleEn: '' }] },
        });
        return { total, missing };
      },
    ],
    [
      'BlogCategory.nameEn',
      async () => {
        const total = await prisma.blogCategory.count();
        const missing = await prisma.blogCategory.count({
          where: { OR: [{ nameEn: null }, { nameEn: '' }] },
        });
        return { total, missing };
      },
    ],
    [
      'StaticPage.titleEn',
      async () => {
        const total = await prisma.staticPage.count();
        const missing = await prisma.staticPage.count({
          where: { OR: [{ titleEn: null }, { titleEn: '' }] },
        });
        return { total, missing };
      },
    ],
    [
      'Bundle.nameEn',
      async () => {
        const total = await prisma.bundle.count({ where: { isActive: true } });
        const missing = await prisma.bundle.count({
          where: { isActive: true, OR: [{ nameEn: null }, { nameEn: '' }] },
        });
        return { total, missing };
      },
    ],
    [
      'FaqItem.questionEn',
      async () => {
        const total = await prisma.faqItem.count({ where: { isPublished: true } });
        const missing = await prisma.faqItem.count({
          where: { isPublished: true, OR: [{ questionEn: null }, { questionEn: '' }] },
        });
        return { total, missing };
      },
    ],
  ];

  console.log('EN translation coverage:');
  console.log('─────────────────────────────────────────────────────────');
  for (const [label, fn] of rows) {
    const { total, missing } = await fn();
    const done = total - missing;
    const pct = total === 0 ? 100 : Math.round((done / total) * 100);
    console.log(`  ${label.padEnd(36)} ${done}/${total} (${pct}%)`);
  }
  console.log('─────────────────────────────────────────────────────────');
}

async function copyUkToEn() {
  let total = 0;

  total += (
    await prisma.product.updateMany({
      where: { isActive: true, OR: [{ nameEn: null }, { nameEn: '' }] },
      data: {},
    })
  ).count;
  // updateMany cannot copy a field to another — fall back to raw SQL for each model.
  await prisma.$executeRawUnsafe(
    `UPDATE products SET name_en = name WHERE is_active = true AND (name_en IS NULL OR name_en = '')`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE product_content SET
       full_description_en = COALESCE(NULLIF(full_description_en, ''), full_description),
       short_description_en = COALESCE(NULLIF(short_description_en, ''), short_description),
       specifications_en   = COALESCE(NULLIF(specifications_en, ''), specifications),
       seo_title_en        = COALESCE(NULLIF(seo_title_en, ''), seo_title),
       seo_description_en  = COALESCE(NULLIF(seo_description_en, ''), seo_description)`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE categories SET
       name_en = COALESCE(NULLIF(name_en, ''), name),
       description_en = COALESCE(NULLIF(description_en, ''), description),
       seo_title_en = COALESCE(NULLIF(seo_title_en, ''), seo_title),
       seo_description_en = COALESCE(NULLIF(seo_description_en, ''), seo_description)
     WHERE deleted_at IS NULL`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE brands SET
       name_en = COALESCE(NULLIF(name_en, ''), name),
       description_en = COALESCE(NULLIF(description_en, ''), description),
       seo_title_en = COALESCE(NULLIF(seo_title_en, ''), seo_title),
       seo_description_en = COALESCE(NULLIF(seo_description_en, ''), seo_description)
     WHERE deleted_at IS NULL`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE blog_posts SET
       title_en = COALESCE(NULLIF(title_en, ''), title),
       excerpt_en = COALESCE(NULLIF(excerpt_en, ''), excerpt),
       content_en = COALESCE(NULLIF(content_en, ''), content),
       seo_title_en = COALESCE(NULLIF(seo_title_en, ''), seo_title),
       seo_description_en = COALESCE(NULLIF(seo_description_en, ''), seo_description)
     WHERE deleted_at IS NULL`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE blog_categories SET
       name_en = COALESCE(NULLIF(name_en, ''), name),
       description_en = COALESCE(NULLIF(description_en, ''), description),
       seo_title_en = COALESCE(NULLIF(seo_title_en, ''), seo_title),
       seo_description_en = COALESCE(NULLIF(seo_description_en, ''), seo_description)`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE static_pages SET
       title_en = COALESCE(NULLIF(title_en, ''), title),
       content_en = COALESCE(NULLIF(content_en, ''), content),
       seo_title_en = COALESCE(NULLIF(seo_title_en, ''), seo_title),
       seo_description_en = COALESCE(NULLIF(seo_description_en, ''), seo_description)`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE bundles SET
       name_en = COALESCE(NULLIF(name_en, ''), name),
       description_en = COALESCE(NULLIF(description_en, ''), description)
     WHERE is_active = true`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE faq_items SET
       question_en = COALESCE(NULLIF(question_en, ''), question),
       answer_en = COALESCE(NULLIF(answer_en, ''), answer)
     WHERE is_published = true`,
  );

  console.log(`Готово. EN-поля заповнено копією uk-значень — заміни через адмінку або GPT-batch.`);
  return total;
}

async function main() {
  if (shouldCopy) {
    console.log('⚠️  --copy-uk-to-en: копіюю українські значення в *En поля…\n');
    await copyUkToEn();
    console.log();
  }
  await report();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
