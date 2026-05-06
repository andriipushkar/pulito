/**
 * Rebuild ProductImage rows from files already on disk.
 *
 * Use case: ProductImage records were lost (e.g. by TRUNCATE CASCADE) but
 * the actual variant files are still in /uploads/products/<code>/.
 *
 * Scans each product's directory, groups files by timestamp prefix
 * (`<code>_<ts>_*`), and creates a ProductImage row pointing to the
 * existing variants. The first image per product is set as `isMain`.
 *
 * Idempotent: skips products that already have images in DB.
 */
import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

interface VariantSet {
  timestamp: string;
  original?: string; // _original.{ext}
  full?: string; // _800x800.webp
  medium?: string; // _400x400.webp
  thumbnail?: string; // _150x150.webp
  blur?: string; // _20x20.webp
}

function groupByTimestamp(files: string[], productCode: string): VariantSet[] {
  const groups = new Map<string, VariantSet>();
  for (const f of files) {
    // Filename pattern: <CODE>_<timestamp>_<suffix>
    const match = f.match(new RegExp(`^${escapeRegex(productCode)}_(\\d+)_(.+)$`, 'i'));
    if (!match) continue;
    const [, ts, suffix] = match;
    const set = groups.get(ts) ?? { timestamp: ts };

    if (/^original\./i.test(suffix)) set.original = f;
    else if (/^800x800\./i.test(suffix)) set.full = f;
    else if (/^400x400\./i.test(suffix)) set.medium = f;
    else if (/^150x150\./i.test(suffix)) set.thumbnail = f;
    else if (/^20x20\./i.test(suffix)) set.blur = f;

    groups.set(ts, set);
  }
  return Array.from(groups.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      code: true,
      images: { select: { id: true } },
    },
  });

  let restored = 0;
  let skippedHasImages = 0;
  let skippedNoFiles = 0;
  let createdRows = 0;

  for (const product of products) {
    if (product.images.length > 0) {
      skippedHasImages++;
      continue;
    }

    const dirPath = path.join(UPLOAD_DIR, 'products', product.code.toLowerCase());
    let files: string[];
    try {
      files = await fs.readdir(dirPath);
    } catch {
      skippedNoFiles++;
      continue;
    }

    const variants = groupByTimestamp(files, product.code);
    if (variants.length === 0) {
      skippedNoFiles++;
      continue;
    }

    for (const [idx, v] of variants.entries()) {
      const buildPath = (filename?: string) =>
        filename ? `/uploads/products/${product.code.toLowerCase()}/${filename}` : null;

      // Need at least full to be useful
      if (!v.full) continue;

      await prisma.productImage.create({
        data: {
          productId: product.id,
          originalFilename: v.original ?? v.full,
          pathOriginal: buildPath(v.original ?? v.full)!,
          pathFull: buildPath(v.full)!,
          pathMedium: buildPath(v.medium ?? v.full)!,
          pathThumbnail: buildPath(v.thumbnail ?? v.full)!,
          pathBlur: buildPath(v.blur) ?? buildPath(v.full)!,
          format: 'webp',
          sizeBytes: 0, // unknown without re-reading; doesn't break the FE
          isMain: idx === 0,
          sortOrder: idx,
        },
      });
      createdRows++;
    }

    // Set legacy product.imagePath = first medium variant
    const firstMedium = buildPath(variants[0].medium ?? variants[0].full);
    if (firstMedium) {
      await prisma.product.update({
        where: { id: product.id },
        data: { imagePath: firstMedium },
      });
    }
    restored++;

    function buildPath(filename?: string): string | null {
      return filename ? `/uploads/products/${product.code.toLowerCase()}/${filename}` : null;
    }
  }

  console.log(`[restore-images] DONE`);
  console.log(`  Total products:          ${products.length}`);
  console.log(`  Restored (had files):    ${restored}`);
  console.log(`  ProductImage rows added: ${createdRows}`);
  console.log(`  Skipped (already had):   ${skippedHasImages}`);
  console.log(`  Skipped (no files):      ${skippedNoFiles}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('[restore-images] FAILED:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
