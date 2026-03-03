import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Delete all existing banners
  await prisma.banner.deleteMany({});
  console.log('Deleted old banners');

  // Create 3 image-based banners (1920×440 PNG)
  const banners = await Promise.all([
    prisma.banner.create({
      data: {
        title: null,
        subtitle: null,
        imageDesktop: '/images/banners/banner-1.png',
        buttonLink: '/catalog?promo=true',
        buttonText: null,
        sortOrder: 1,
        isActive: true,
      },
    }),
    prisma.banner.create({
      data: {
        title: null,
        subtitle: null,
        imageDesktop: '/images/banners/banner-2.png',
        buttonLink: '/catalog?promo=true',
        buttonText: null,
        sortOrder: 2,
        isActive: true,
      },
    }),
    prisma.banner.create({
      data: {
        title: null,
        subtitle: null,
        imageDesktop: '/images/banners/banner-3.png',
        buttonLink: '/pages/delivery',
        buttonText: null,
        sortOrder: 3,
        isActive: true,
      },
    }),
  ]);

  console.log(`Created ${banners.length} image-based banners`);
  for (const b of banners) {
    console.log(`  #${b.id}: ${b.title} → ${b.imageDesktop}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
