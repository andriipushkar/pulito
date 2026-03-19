import sharp from 'sharp';

/**
 * Sanitize an uploaded image by re-encoding it through sharp.
 * This strips all EXIF/metadata, prevents polyglot file attacks
 * (e.g. PHP/JS code embedded in image metadata), and normalizes
 * the output to WebP format.
 *
 * @param buffer - Raw image buffer from upload
 * @param maxWidth - Maximum width (default: 2048)
 * @param quality - WebP quality (default: 85)
 * @returns Sanitized WebP buffer
 */
export async function sanitizeImage(
  buffer: Buffer,
  maxWidth = 2048,
  quality = 85
): Promise<Buffer> {
  return sharp(buffer)
    .resize(maxWidth, maxWidth, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .rotate() // Auto-rotate based on EXIF orientation before stripping
    .webp({ quality })
    .toBuffer();
}
