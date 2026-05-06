/**
 * Regenerate variant images (full/medium/thumbnail/blur) for all existing
 * ProductImage rows using the current image-processing logic.
 *
 * Run after upgrading image.ts to apply new padding/contain rules to legacy
 * uploads without re-uploading originals manually.
 *
 * Usage:
 *   npx tsx scripts/regenerate-product-images.ts            # all images
 *   npx tsx scripts/regenerate-product-images.ts --product 42  # single product
 *   npx tsx scripts/regenerate-product-images.ts --dry-run     # report only, no writes
 */

import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { readFile, uploadFile } from '@/lib/storage';

const SIZES = {
  full: { width: 800, height: 800 },
  medium: { width: 400, height: 400 },
  thumbnail: { width: 150, height: 150 },
  blur: { width: 20, height: 20 },
} as const;

const PAD_BACKGROUND = { r: 245, g: 245, b: 245, alpha: 1 };
const WATERMARK_TEXT = process.env.WATERMARK_TEXT || 'pulito.trade';
const WATERMARK_ENABLED = process.env.WATERMARK_ENABLED !== 'false';

interface Args {
  productId?: number;
  dryRun: boolean;
}

function parseArgs(): Args {
  const args: Args = { dryRun: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--product' && argv[i + 1]) {
      args.productId = parseInt(argv[++i], 10);
    }
  }
  return args;
}

/**
 * Convert a stored DB path back into a storage key understood by readFile/uploadFile.
 * Examples:
 *   "/uploads/products/p001/img.webp"       → "products/p001/img.webp"
 *   "https://media.pulito.trade/products/.." → "products/.."
 */
function pathToKey(dbPath: string): string {
  if (dbPath.startsWith('http')) {
    const u = new URL(dbPath);
    return u.pathname.replace(/^\/+/, '');
  }
  return dbPath.replace(/^\/?(uploads\/)?/, '');
}

async function generateVariant(
  sourceBuffer: Buffer,
  variantKey: keyof typeof SIZES,
): Promise<Buffer> {
  const size = SIZES[variantKey];
  let pipeline = sharp(sourceBuffer).resize(size.width, size.height, {
    fit: 'contain',
    background: PAD_BACKGROUND,
    withoutEnlargement: false,
  });

  if (variantKey === 'blur') {
    pipeline = pipeline.blur(5).webp({ quality: 20 });
  } else {
    pipeline = pipeline.webp({ quality: 80 });
  }

  if (WATERMARK_ENABLED && (variantKey === 'full' || variantKey === 'medium')) {
    const resizedBuffer = await pipeline.toBuffer();
    const meta = await sharp(resizedBuffer).metadata();
    const w = meta.width || size.width;
    const h = meta.height || size.height;
    const fontSize = Math.max(12, Math.floor(w * 0.035));
    const pad = Math.floor(fontSize * 0.5);
    const svgWatermark = `<svg width="${w}" height="${h}">
      <style>.wm { fill: rgba(255,255,255,0.5); font-size: ${fontSize}px; font-family: Arial, sans-serif; font-weight: bold; }</style>
      <text x="${w - pad}" y="${h - pad}" text-anchor="end" class="wm">${WATERMARK_TEXT}</text>
    </svg>`;
    return await sharp(resizedBuffer)
      .composite([{ input: Buffer.from(svgWatermark), gravity: 'southeast' }])
      .toBuffer();
  }

  return await pipeline.toBuffer();
}

async function main() {
  const { productId, dryRun } = parseArgs();
  console.log(
    `[regen] ${dryRun ? 'DRY RUN — ' : ''}Starting regeneration${productId ? ` for product ${productId}` : ''}…`,
  );

  const where = productId ? { productId } : {};
  const total = await prisma.productImage.count({ where });
  console.log(`[regen] Found ${total} ProductImage rows`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  const batchSize = 25;

  for (let offset = 0; offset < total; offset += batchSize) {
    const images = await prisma.productImage.findMany({
      where,
      skip: offset,
      take: batchSize,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        productId: true,
        pathOriginal: true,
        pathFull: true,
        pathMedium: true,
        pathThumbnail: true,
        pathBlur: true,
      },
    });

    for (const img of images) {
      const tag = `[image #${img.id} / product #${img.productId}]`;
      try {
        if (!img.pathOriginal) {
          console.warn(`${tag} no pathOriginal — skipping`);
          skipped++;
          continue;
        }

        const originalKey = pathToKey(img.pathOriginal);
        const sourceBuffer = await readFile(originalKey);
        if (!sourceBuffer) {
          console.warn(`${tag} original file not found at "${originalKey}" — skipping`);
          skipped++;
          continue;
        }

        const targets = [
          { key: 'full' as const, dbPath: img.pathFull },
          { key: 'medium' as const, dbPath: img.pathMedium },
          { key: 'thumbnail' as const, dbPath: img.pathThumbnail },
          { key: 'blur' as const, dbPath: img.pathBlur },
        ];

        for (const t of targets) {
          if (!t.dbPath) continue;
          const buffer = await generateVariant(sourceBuffer, t.key);
          if (!dryRun) {
            await uploadFile(pathToKey(t.dbPath), buffer, 'image/webp');
          }
        }

        processed++;
        if (processed % 10 === 0) {
          console.log(`[regen] progress: ${processed}/${total}`);
        }
      } catch (err) {
        errors++;
        console.error(`${tag} error:`, err instanceof Error ? err.message : err);
      }
    }
  }

  console.log(
    `[regen] DONE — processed: ${processed}, skipped: ${skipped}, errors: ${errors}, total: ${total}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[regen] FATAL:', err);
    process.exit(1);
  });
