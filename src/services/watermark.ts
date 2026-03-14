import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

const WATERMARK_TEXT = process.env.WATERMARK_TEXT || 'poroshok.com';
const UPLOADS_DIR = path.join(process.cwd(), 'public');

/**
 * Apply a text watermark to an image.
 * Returns the path to the watermarked image (saved alongside the original with _wm suffix).
 */
export async function applyWatermark(imagePath: string): Promise<string> {
  const fullPath = path.join(UPLOADS_DIR, imagePath);
  const ext = path.extname(imagePath);
  const baseName = imagePath.slice(0, -ext.length);
  const wmPath = `${baseName}_wm${ext}`;
  const wmFullPath = path.join(UPLOADS_DIR, wmPath);

  // Check if watermarked version already exists
  try {
    await fs.access(wmFullPath);
    return wmPath;
  } catch {
    // doesn't exist, create it
  }

  const image = sharp(fullPath);
  const metadata = await image.metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 600;

  // Create SVG watermark text
  const fontSize = Math.max(16, Math.floor(width * 0.04));
  const padding = Math.floor(fontSize * 0.5);

  const svgText = `
    <svg width="${width}" height="${height}">
      <style>
        .watermark {
          fill: rgba(255, 255, 255, 0.6);
          font-size: ${fontSize}px;
          font-family: Arial, sans-serif;
          font-weight: bold;
        }
      </style>
      <text
        x="${width - padding}"
        y="${height - padding}"
        text-anchor="end"
        class="watermark"
      >${WATERMARK_TEXT}</text>
    </svg>
  `;

  await image
    .composite([
      {
        input: Buffer.from(svgText),
        gravity: 'southeast',
      },
    ])
    .toFile(wmFullPath);

  return wmPath;
}
