import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
(async () => {
  const p = await prisma.product.count();
  const pe = await prisma.product.count({ where: { nameEn: { not: null } } });
  const bp = await prisma.blogPost.count();
  const bpe = await prisma.blogPost.count({ where: { titleEn: { not: null } } });
  const c = await prisma.category.count();
  const ce = await prisma.category.count({ where: { nameEn: { not: null } } });
  const pc = await prisma.productContent.count();
  const pce = await prisma.productContent.count({ where: { fullDescriptionEn: { not: null } } });
  console.log(`Product nameEn:           ${pe}/${p}`);
  console.log(`ProductContent fullDescEn:${pce}/${pc}`);
  console.log(`BlogPost titleEn:         ${bpe}/${bp}`);
  console.log(`Category nameEn:          ${ce}/${c}`);
  await prisma.$disconnect();
})();
