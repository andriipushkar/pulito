import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Recategorizing products...\n');

  // 1. Create new categories
  const newCategories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'zasoby-dlya-prannya' },
      update: { name: 'Засоби для прання', sortOrder: 1, isVisible: true, parentId: null },
      create: {
        name: 'Засоби для прання',
        slug: 'zasoby-dlya-prannya',
        description: 'Пральні порошки, гелі, капсули, кондиціонери та плямовивідники',
        sortOrder: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'zasoby-dlya-myttya-ta-chyshchennya' },
      update: { name: 'Засоби для миття та чищення', sortOrder: 2, isVisible: true, parentId: null },
      create: {
        name: 'Засоби для миття та чищення',
        slug: 'zasoby-dlya-myttya-ta-chyshchennya',
        description: 'Засоби для миття посуду, підлоги, ванної, кухні, скла та поверхонь',
        sortOrder: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'zasoby-hihiyeny' },
      update: { name: 'Засоби гігієни', sortOrder: 3, isVisible: true, parentId: null },
      create: {
        name: 'Засоби гігієни',
        slug: 'zasoby-hihiyeny',
        description: 'Туалетний папір, серветки, рушники та засоби особистої гігієни',
        sortOrder: 3,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'tovary-dlya-domu' },
      update: { name: 'Товари для дому', sortOrder: 4, isVisible: true, parentId: null },
      create: {
        name: 'Товари для дому',
        slug: 'tovary-dlya-domu',
        description: 'Освіжувачі повітря, губки, ганчірки, швабри, рукавички, пакети',
        sortOrder: 4,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'dohlyad-za-tilom' },
      update: { name: 'Догляд за тілом', sortOrder: 5, isVisible: true, parentId: null },
      create: {
        name: 'Догляд за тілом',
        slug: 'dohlyad-za-tilom',
        description: 'Гелі для душу, мило, креми, лосьйони та дезодоранти',
        sortOrder: 5,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'dohlyad-za-volossyam' },
      update: { name: 'Догляд за волоссям', sortOrder: 6, isVisible: true, parentId: null },
      create: {
        name: 'Догляд за волоссям',
        slug: 'dohlyad-za-volossyam',
        description: 'Шампуні, бальзами, маски та засоби для укладки волосся',
        sortOrder: 6,
      },
    }),
  ]);

  const [prannya, myttya, hihiyena, dim, tilo, volosya] = newCategories;
  console.log(`Created/updated ${newCategories.length} new categories`);

  // 2. Map existing products by code to new categories
  const categoryMap: Record<string, number> = {
    // Засоби для прання
    'TIDE-ALPINE-3KG': prannya.id,
    'ARIEL-PODS-30': prannya.id,
    'TIDE-GEL-1.5L': prannya.id,
    'ARIEL-POWDER-3KG': prannya.id,
    'PERSIL-GEL-1L': prannya.id,
    'LENOR-SOFTENER-1L': prannya.id,
    'VANISH-OXI-450': prannya.id,
    'CALGON-TABS-15': prannya.id,

    // Засоби для миття та чищення
    'MR-PROPER-LEMON-1L': myttya.id,
    'MR-PROPER-OCEAN-1L': myttya.id,
    'PRONTO-POLISH-250': myttya.id,
    'CLIN-MULTI-500': myttya.id,
    'FROSCH-UNIVERSAL-750': myttya.id,
    'DOMESTOS-FRESH-750': myttya.id,
    'DOMESTOS-LEMON-750': myttya.id,
    'CILLIT-BANG-750': myttya.id,
    'BREF-WC-BLOCK-3': myttya.id,
    'SANFOR-GEL-750': myttya.id,
    'FAIRY-LEMON-450': myttya.id,
    'FAIRY-SENSETIVE-450': myttya.id,
    'FAIRY-PLATINUM-430': myttya.id,
    'FINISH-TABS-50': myttya.id,
    'FINISH-TABS-100': myttya.id,
    'SOMAT-TABS-60': myttya.id,
    'GALA-LEMON-500': myttya.id,
    'GALA-ALOE-500': myttya.id,
    'CLIN-GLASS-500': myttya.id,
    'MR-MUSCLE-GLASS-500': myttya.id,
    'HELP-GLASS-750': myttya.id,
    'SARMA-POWDER-400': myttya.id,
    'PEMOLUX-POWDER-480': myttya.id,
    'FROSCH-KITCHEN-500': myttya.id,

    // Засоби гігієни
    'ZEWA-DELUXE-8': hihiyena.id,
    'ZEWA-DELUXE-16': hihiyena.id,
    'ZEWA-TOWEL-2': hihiyena.id,
    'KLEENEX-TISSUES-100': hihiyena.id,
    'RUTA-NAPKINS-100': hihiyena.id,
    'SELPAK-TISSUE-150': hihiyena.id,

    // Товари для дому
    'GLADE-AUTO-269': dim.id,
    'GLADE-SPRAY-300': dim.id,
    'AIRWICK-ELEC-19': dim.id,
    'AIRWICK-REFILL-250': dim.id,
    'BRISE-CANDLE-120': dim.id,
    'SCOTCH-BRITE-3': dim.id,
    'VILEDA-MOP-TWIST': dim.id,
    'VILEDA-CLOTH-3': dim.id,
    'SPONTEX-GLOVES-M': dim.id,
    'FREKEN-BOK-BAGS-35': dim.id,
  };

  // 3. Reassign existing products
  let updated = 0;
  for (const [code, categoryId] of Object.entries(categoryMap)) {
    const result = await prisma.product.updateMany({
      where: { code },
      data: { categoryId },
    });
    updated += result.count;
  }
  console.log(`Reassigned ${updated} existing products`);

  // 4. Add new products for "Догляд за тілом"
  const bodyProducts = [
    { code: 'DOVE-SHOWER-250', name: 'Dove крем-гель для душу Ніжне шовкове 250мл', slug: 'dove-krem-gel-dlya-dushu-nizhne-shovkove-250ml', categoryId: tilo.id, priceRetail: 119.0, priceWholesale: 98.0, quantity: 80, isPromo: false },
    { code: 'NIVEA-SHOWER-500', name: 'Nivea гель для душу Свіжість океану 500мл', slug: 'nivea-gel-dlya-dushu-svizhist-okeanu-500ml', categoryId: tilo.id, priceRetail: 145.0, priceWholesale: 120.0, quantity: 65, isPromo: false },
    { code: 'PALMOLIVE-SOAP-90', name: 'Palmolive мило Натурель Оливка 90г', slug: 'palmolive-mylo-naturel-olyvka-90g', categoryId: tilo.id, priceRetail: 29.0, priceWholesale: 22.0, quantity: 300, isPromo: false },
    { code: 'DOVE-CREAM-75', name: 'Dove крем для рук Інтенсивний догляд 75мл', slug: 'dove-krem-dlya-ruk-intensyvniy-dohlyad-75ml', categoryId: tilo.id, priceRetail: 89.0, priceWholesale: 72.0, quantity: 90, isPromo: true, priceRetailOld: 109.0 },
    { code: 'REXONA-DEO-150', name: 'Rexona дезодорант-спрей Невидимий 150мл', slug: 'rexona-dezodorant-sprey-nevydymiy-150ml', categoryId: tilo.id, priceRetail: 109.0, priceWholesale: 89.0, quantity: 100, isPromo: false },
    { code: 'NIVEA-BODY-250', name: 'Nivea лосьйон для тіла Ніжність 250мл', slug: 'nivea-losyon-dlya-tila-nizhnist-250ml', categoryId: tilo.id, priceRetail: 159.0, priceWholesale: 130.0, quantity: 55, isPromo: false },
    { code: 'SAFEGUARD-SOAP-90', name: 'Safeguard антибактеріальне мило Класичне 90г', slug: 'safeguard-antybakterialne-mylo-klasychne-90g', categoryId: tilo.id, priceRetail: 35.0, priceWholesale: 27.0, quantity: 250, isPromo: false },
    { code: 'FA-SHOWER-250', name: 'Fa гель для душу Yoghurt Алое Вера 250мл', slug: 'fa-gel-dlya-dushu-yoghurt-aloe-vera-250ml', categoryId: tilo.id, priceRetail: 99.0, priceWholesale: 80.0, quantity: 70, isPromo: true, priceRetailOld: 119.0 },
  ];

  // 5. Add new products for "Догляд за волоссям"
  const hairProducts = [
    { code: 'HEAD-SHOULDERS-400', name: 'Head & Shoulders шампунь Основний догляд 400мл', slug: 'head-shoulders-shampun-osnovniy-dohlyad-400ml', categoryId: volosya.id, priceRetail: 169.0, priceWholesale: 140.0, quantity: 75, isPromo: false },
    { code: 'PANTENE-SHAMPOO-400', name: 'Pantene Pro-V шампунь Густе та міцне 400мл', slug: 'pantene-pro-v-shampun-guste-ta-mitsne-400ml', categoryId: volosya.id, priceRetail: 179.0, priceWholesale: 148.0, quantity: 60, isPromo: false },
    { code: 'GARNIER-FRUCTIS-400', name: 'Garnier Fructis шампунь Ріст на повну силу 400мл', slug: 'garnier-fructis-shampun-rist-na-povnu-sylu-400ml', categoryId: volosya.id, priceRetail: 149.0, priceWholesale: 122.0, quantity: 85, isPromo: true, priceRetailOld: 179.0 },
    { code: 'LOREAL-ELSEVE-250', name: "L'Oréal Elseve бальзам Повне відновлення 250мл", slug: 'loreal-elseve-balzam-povne-vidnovlennya-250ml', categoryId: volosya.id, priceRetail: 159.0, priceWholesale: 130.0, quantity: 50, isPromo: false },
    { code: 'DOVE-HAIR-250', name: 'Dove шампунь Інтенсивне відновлення 250мл', slug: 'dove-shampun-intensyvne-vidnovlennya-250ml', categoryId: volosya.id, priceRetail: 129.0, priceWholesale: 105.0, quantity: 70, isPromo: false },
    { code: 'GLISS-KUR-MASK-300', name: 'Gliss Kur маска для волосся Екстремальне відновлення 300мл', slug: 'gliss-kur-maska-ekstremalne-vidnovlennya-300ml', categoryId: volosya.id, priceRetail: 189.0, priceWholesale: 155.0, quantity: 40, isPromo: false },
    { code: 'SCHAUMA-SHAMPOO-400', name: 'Schauma шампунь 7 Трав свіжість 400мл', slug: 'schauma-shampun-7-trav-svizhist-400ml', categoryId: volosya.id, priceRetail: 109.0, priceWholesale: 89.0, quantity: 95, isPromo: false },
    { code: 'TRESEMME-SPRAY-200', name: 'TRESemmé спрей для укладки Термозахист 200мл', slug: 'tresemme-sprey-dlya-ukladky-termozakhyst-200ml', categoryId: volosya.id, priceRetail: 199.0, priceWholesale: 165.0, quantity: 35, isPromo: true, priceRetailOld: 239.0 },
  ];

  const allNew = [...bodyProducts, ...hairProducts];
  let created = 0;
  for (const data of allNew) {
    await prisma.product.upsert({
      where: { code: data.code },
      update: { categoryId: data.categoryId },
      create: {
        code: data.code,
        name: data.name,
        slug: data.slug,
        categoryId: data.categoryId,
        priceRetail: data.priceRetail,
        priceWholesale: data.priceWholesale,
        priceRetailOld: data.priceRetailOld ?? null,
        quantity: data.quantity,
        isPromo: data.isPromo,
      },
    });
    created++;
  }
  console.log(`Created/updated ${created} new products (body care + hair care)`);

  // 6. Delete old subcategories (set products to parent first, just in case)
  const oldSubSlugs = ['gel-dlya-posudu', 'tabletky-dlya-pmm', 'gel-dlya-prannya', 'poroshok-dlya-prannya'];
  for (const slug of oldSubSlugs) {
    const cat = await prisma.category.findUnique({ where: { slug } });
    if (cat) {
      // Move any remaining products to the correct new category
      await prisma.product.updateMany({
        where: { categoryId: cat.id },
        data: { categoryId: myttya.id },
      });
      await prisma.category.delete({ where: { id: cat.id } });
      console.log(`  Deleted old subcategory: ${cat.name}`);
    }
  }

  // 7. Delete old main categories
  const oldMainSlugs = [
    'myiuchi-zasoby', 'pralni-poroshky', 'zasoby-dlya-vannoyi',
    'zasoby-dlya-kukhni', 'osvizhuvachi-povitrya', 'paperovi-vyroby',
    'zasoby-dlya-prybyranya', 'zasoby-dlya-skla',
  ];
  for (const slug of oldMainSlugs) {
    const cat = await prisma.category.findUnique({ where: { slug } });
    if (cat) {
      // Move any remaining products just in case
      const remaining = await prisma.product.count({ where: { categoryId: cat.id } });
      if (remaining > 0) {
        await prisma.product.updateMany({
          where: { categoryId: cat.id },
          data: { categoryId: myttya.id },
        });
        console.log(`  Moved ${remaining} orphaned products from ${cat.name}`);
      }
      await prisma.category.delete({ where: { id: cat.id } });
      console.log(`  Deleted old category: ${cat.name}`);
    }
  }

  // 8. Summary
  const finalCategories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { sortOrder: 'asc' },
  });
  console.log('\n--- Final categories ---');
  for (const cat of finalCategories) {
    console.log(`  ${cat.name}: ${cat._count.products} товарів`);
  }

  const totalProducts = await prisma.product.count();
  console.log(`\nTotal products: ${totalProducts}`);
  console.log('Done!');
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
