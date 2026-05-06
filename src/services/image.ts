import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { validateFileType } from '@/utils/file-validation';
import { uploadFile, isCloudStorageEnabled } from '@/lib/storage';
import { removeBackground, isBackgroundRemovalEnabled } from '@/services/background-removal';

const WATERMARK_TEXT = process.env.WATERMARK_TEXT || 'pulito.trade';
const WATERMARK_ENABLED = process.env.WATERMARK_ENABLED !== 'false'; // enabled by default

export class ImageError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ImageError';
  }
}

const SIZES = {
  full: { width: 800, height: 800 },
  medium: { width: 400, height: 400 },
  thumbnail: { width: 150, height: 150 },
  blur: { width: 20, height: 20 },
} as const;

// Padding background — matches --color-bg-secondary so the auto-padded canvas
// blends seamlessly with product card containers on the site.
const PAD_BACKGROUND = { r: 245, g: 245, b: 245, alpha: 1 };

const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_DIMENSION = 300; // px — smaller uploads would look pixelated when padded to 800px

function getUploadDir(): string {
  return env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
}

function getProductImageDir(productCode: string): string {
  return path.join(getUploadDir(), 'products', productCode.toLowerCase());
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function processProductImage(
  fileBuffer: Buffer,
  mimeType: string,
  originalFilename: string,
  productId: number,
  isMain = false,
  options: { removeBg?: boolean } = {},
) {
  if (!ALLOWED_FORMATS.includes(mimeType)) {
    throw new ImageError('Непідтримуваний формат. Дозволені: JPG, PNG, WebP', 400);
  }

  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new ImageError('Максимальний розмір файлу: 5 МБ', 400);
  }

  const { valid } = await validateFileType(fileBuffer, ALLOWED_FORMATS);
  if (!valid) {
    throw new ImageError('Вміст файлу не відповідає заявленому формату', 400);
  }

  // Get product
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, code: true },
  });

  if (!product) {
    throw new ImageError('Товар не знайдено', 404);
  }

  const imageDir = getProductImageDir(product.code);
  await ensureDir(imageDir);

  const metadata = await sharp(fileBuffer).metadata();

  // Reject too-small uploads — when padded to 800x800 they look low-res.
  const srcW = metadata.width ?? 0;
  const srcH = metadata.height ?? 0;
  if (srcW < MIN_DIMENSION || srcH < MIN_DIMENSION) {
    throw new ImageError(
      `Мінімальний розмір фото: ${MIN_DIMENSION}×${MIN_DIMENSION} px. Ваше: ${srcW}×${srcH} px.`,
      400,
    );
  }

  // Optional automatic background removal — replaces fileBuffer with a PNG
  // that has transparent background. Subsequent variants composite the PNG
  // onto PAD_BACKGROUND so the WebP output blends seamlessly with the site.
  let processBuffer = fileBuffer;
  let processMime = mimeType;
  let bgRemoved = false;
  if (options.removeBg && isBackgroundRemovalEnabled()) {
    const cutout = await removeBackground(fileBuffer, mimeType);
    if (cutout) {
      processBuffer = cutout;
      processMime = 'image/png';
      bgRemoved = true;
    }
  }

  const timestamp = Date.now();
  const baseName = `${product.code}_${timestamp}`;

  // Save original — uses R2 cloud storage when configured, local fallback otherwise
  const originalFilenameOnDisk = `${baseName}_original${getExtension(mimeType)}`;
  const originalPath = path.join(imageDir, originalFilenameOnDisk);
  if (isCloudStorageEnabled()) {
    const storageKey = `products/${product.code.toLowerCase()}/${originalFilenameOnDisk}`;
    await uploadFile(storageKey, fileBuffer, mimeType);
  } else {
    await fs.writeFile(originalPath, fileBuffer);
  }

  // Generate resized variants as WebP (with watermark on full & medium)
  const variants = await Promise.all(
    Object.entries(SIZES).map(async ([key, size]) => {
      const filename = `${baseName}_${size.width}x${size.height}.webp`;
      const filePath = path.join(imageDir, filename);

      // fit:'contain' keeps original aspect ratio AND pads the result to the
      // exact target square with PAD_BACKGROUND. So a 1024×800 photo becomes
      // a true 800×800 with grey strips top/bottom — site renders it without
      // any "gaps" because the canvas already matches the container.
      // When background was removed (PNG with alpha), `flatten` composites
      // the cutout onto PAD_BACKGROUND so transparent areas become uniform.
      let pipeline = sharp(processBuffer).resize(size.width, size.height, {
        fit: 'contain',
        background: PAD_BACKGROUND,
        withoutEnlargement: false,
      });
      if (bgRemoved) {
        pipeline = pipeline.flatten({ background: PAD_BACKGROUND });
      }

      if (key === 'blur') {
        pipeline = pipeline.blur(5).webp({ quality: 20 });
      } else {
        pipeline = pipeline.webp({ quality: 80 });
      }

      // Apply watermark to full and medium sizes
      let variantBuffer: Buffer;
      if (WATERMARK_ENABLED && (key === 'full' || key === 'medium')) {
        const resizedBuffer = await pipeline.toBuffer();
        const resizedMeta = await sharp(resizedBuffer).metadata();
        const w = resizedMeta.width || size.width;
        const h = resizedMeta.height || size.height;
        const fontSize = Math.max(12, Math.floor(w * 0.035));
        const pad = Math.floor(fontSize * 0.5);

        const svgWatermark = `
          <svg width="${w}" height="${h}">
            <style>.wm { fill: rgba(255,255,255,0.5); font-size: ${fontSize}px; font-family: Arial, sans-serif; font-weight: bold; }</style>
            <text x="${w - pad}" y="${h - pad}" text-anchor="end" class="wm">${WATERMARK_TEXT}</text>
          </svg>`;

        variantBuffer = await sharp(resizedBuffer)
          .composite([{ input: Buffer.from(svgWatermark), gravity: 'southeast' }])
          .toBuffer();
      } else {
        variantBuffer = await pipeline.toBuffer();
      }

      // Save variant to cloud storage or local disk
      if (isCloudStorageEnabled()) {
        const storageKey = `products/${product.code.toLowerCase()}/${filename}`;
        await uploadFile(storageKey, variantBuffer, 'image/webp');
      } else {
        await fs.writeFile(filePath, variantBuffer);
      }

      return { key, path: getRelativePath(filePath) };
    }),
  );

  const pathMap: Record<string, string> = {};
  for (const v of variants) {
    pathMap[v.key] = v.path;
  }

  // If setting as main, unset existing main
  if (isMain) {
    await prisma.productImage.updateMany({
      where: { productId, isMain: true },
      data: { isMain: false },
    });
  }

  // Check if first image (auto set as main)
  const existingImages = await prisma.productImage.count({ where: { productId } });
  const shouldBeMain = isMain || existingImages === 0;

  // Get next sort order
  const lastImage = await prisma.productImage.findFirst({
    where: { productId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  const sortOrder = (lastImage?.sortOrder ?? -1) + 1;

  // Save to DB
  const image = await prisma.productImage.create({
    data: {
      productId,
      originalFilename,
      pathOriginal: getRelativePath(originalPath),
      pathFull: pathMap.full,
      pathMedium: pathMap.medium,
      pathThumbnail: pathMap.thumbnail,
      pathBlur: pathMap.blur,
      format: 'webp',
      sizeBytes: fileBuffer.length,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      isMain: shouldBeMain,
      sortOrder,
    },
  });

  // Also update the product's legacy imagePath field
  if (shouldBeMain) {
    await prisma.product.update({
      where: { id: productId },
      data: { imagePath: pathMap.medium },
    });
  }

  return image;
}

export async function deleteProductImage(imageId: number) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) {
    throw new ImageError('Зображення не знайдено', 404);
  }

  // Delete files from disk
  const uploadDir = getUploadDir();
  const paths = [
    image.pathOriginal,
    image.pathFull,
    image.pathMedium,
    image.pathThumbnail,
    image.pathBlur,
  ].filter(Boolean);

  for (const p of paths) {
    try {
      const resolvedPath = path.resolve(uploadDir, '..', p!);
      const parentDir = path.resolve(uploadDir, '..');
      if (!resolvedPath.startsWith(parentDir + path.sep)) {
        continue; // Skip paths outside upload directory
      }
      await fs.unlink(resolvedPath);
    } catch {
      // File might not exist, ignore
    }
  }

  // If this was the main image, set another as main
  if (image.isMain) {
    const nextImage = await prisma.productImage.findFirst({
      where: { productId: image.productId, id: { not: imageId } },
      orderBy: { sortOrder: 'asc' },
    });
    if (nextImage) {
      await prisma.productImage.update({
        where: { id: nextImage.id },
        data: { isMain: true },
      });
      await prisma.product.update({
        where: { id: image.productId },
        data: { imagePath: nextImage.pathMedium },
      });
    } else {
      await prisma.product.update({
        where: { id: image.productId },
        data: { imagePath: null },
      });
    }
  }

  await prisma.productImage.delete({ where: { id: imageId } });
}

export async function matchImagesFromDirectory(productCode: string) {
  const dir = getProductImageDir(productCode);
  try {
    await fs.access(dir);
  } catch {
    return null;
  }

  const files = await fs.readdir(dir);
  return files.filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
}

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '.jpg';
  }
}

function getRelativePath(absolutePath: string): string {
  const uploadDir = getUploadDir();
  const parentDir = path.dirname(uploadDir);
  return '/' + path.relative(parentDir, absolutePath);
}
