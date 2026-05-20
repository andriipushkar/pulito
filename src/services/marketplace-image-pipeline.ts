import sharp from 'sharp';

/**
 * Marketplace-specific image transformations applied at publish time so the
 * outgoing payload meets each platform's image policy.
 *
 *   OLX:       JPEG, ≥800×600, ≤8 images
 *   Rozetka:   JPEG/WebP, ≥1000×1000 (square preferred), ≤10
 *   Prom:      JPEG/WebP, ≥1000×1000, ≤12
 *   Epicentr:  JPEG, ≥1000×1000, ≤10
 *
 * The existing site image processor already produces 800×800 WebPs; this
 * service upscales / pads / re-encodes to match marketplace policy without
 * mutating the source files.
 */
export type MarketplacePlatform = 'olx' | 'rozetka' | 'prom' | 'epicentrk';

interface PlatformImagePolicy {
  format: 'jpeg' | 'webp';
  minSide: number;
  squarePad: boolean;
  quality: number;
  maxImages: number;
}

const POLICY: Record<MarketplacePlatform, PlatformImagePolicy> = {
  olx: { format: 'jpeg', minSide: 800, squarePad: false, quality: 85, maxImages: 8 },
  rozetka: { format: 'jpeg', minSide: 1000, squarePad: true, quality: 90, maxImages: 10 },
  prom: { format: 'jpeg', minSide: 1000, squarePad: true, quality: 90, maxImages: 12 },
  epicentrk: { format: 'jpeg', minSide: 1000, squarePad: true, quality: 90, maxImages: 10 },
};

const PAD_BACKGROUND = { r: 245, g: 245, b: 245, alpha: 1 };

export interface PreparedImage {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

/**
 * Transforms a single input image buffer (any format Sharp can decode,
 * including HEIC/HEIF when the system libheif is present) to match the
 * given marketplace policy. Idempotent — calling twice with the same
 * input/platform yields the same output bytes.
 */
export async function prepareImageForMarketplace(
  input: Buffer,
  platform: MarketplacePlatform,
): Promise<PreparedImage> {
  const policy = POLICY[platform];
  let pipeline = sharp(input, { failOn: 'none' }).rotate();

  const meta = await pipeline.metadata();
  const srcW = meta.width || 0;
  const srcH = meta.height || 0;
  const targetW = Math.max(policy.minSide, srcW);
  const targetH = policy.squarePad
    ? Math.max(policy.minSide, srcH, targetW)
    : Math.max(policy.minSide, srcH);

  if (policy.squarePad) {
    const side = Math.max(targetW, targetH, policy.minSide);
    pipeline = pipeline.resize({
      width: side,
      height: side,
      fit: 'contain',
      background: PAD_BACKGROUND,
    });
  } else if (srcW < policy.minSide || srcH < policy.minSide) {
    const scale = Math.max(policy.minSide / Math.max(srcW, 1), policy.minSide / Math.max(srcH, 1));
    pipeline = pipeline.resize({
      width: Math.round(srcW * scale),
      height: Math.round(srcH * scale),
      fit: 'inside',
      withoutEnlargement: false,
    });
  }

  let buffer: Buffer;
  if (policy.format === 'jpeg') {
    buffer = await pipeline.flatten({ background: PAD_BACKGROUND }).jpeg({ quality: policy.quality }).toBuffer();
    return { buffer, contentType: 'image/jpeg', extension: 'jpg' };
  }
  buffer = await pipeline.webp({ quality: policy.quality }).toBuffer();
  return { buffer, contentType: 'image/webp', extension: 'webp' };
}

/**
 * Returns the per-platform image limit so callers can `.slice(0, max)`
 * without duplicating the policy table.
 */
export function maxImagesForPlatform(platform: MarketplacePlatform): number {
  return POLICY[platform].maxImages;
}
