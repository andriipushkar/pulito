import { describe, it, expect } from 'vitest';
import { validateFileType } from './file-validation';

// JPEG: FF D8 FF
const jpegBuffer = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
// PNG: 89 50 4E 47
const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
// WebP: 52 49 46 46 (RIFF)
const webpBuffer = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
// Random bytes (not a valid image)
const randomBuffer = Buffer.from([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
]);

describe('validateFileType', () => {
  it('detects JPEG from buffer', async () => {
    const result = await validateFileType(jpegBuffer, ['image/jpeg']);
    expect(result).toEqual({ valid: true, detectedType: 'image/jpeg' });
  });

  it('detects PNG from buffer', async () => {
    const result = await validateFileType(pngBuffer, ['image/png']);
    expect(result).toEqual({ valid: true, detectedType: 'image/png' });
  });

  it('detects WebP from buffer', async () => {
    const result = await validateFileType(webpBuffer, ['image/webp']);
    expect(result).toEqual({ valid: true, detectedType: 'image/webp' });
  });

  it('rejects buffer when type not in allowed list', async () => {
    const result = await validateFileType(jpegBuffer, ['image/png']);
    expect(result).toEqual({ valid: false, detectedType: null });
  });

  it('rejects random bytes', async () => {
    const result = await validateFileType(randomBuffer, ['image/jpeg', 'image/png', 'image/webp']);
    expect(result).toEqual({ valid: false, detectedType: null });
  });

  it('matches first allowed type when multiple provided', async () => {
    const result = await validateFileType(pngBuffer, ['image/jpeg', 'image/png', 'image/webp']);
    expect(result).toEqual({ valid: true, detectedType: 'image/png' });
  });

  it('returns false for empty allowed types list', async () => {
    const result = await validateFileType(jpegBuffer, []);
    expect(result).toEqual({ valid: false, detectedType: null });
  });

  it('handles unknown MIME type in allowed list gracefully', async () => {
    const result = await validateFileType(jpegBuffer, ['application/pdf']);
    expect(result).toEqual({ valid: false, detectedType: null });
  });

  it('validates File objects via arrayBuffer', async () => {
    const blob = new Blob([jpegBuffer], { type: 'image/jpeg' });
    const file = new File([blob], 'test.jpg', { type: 'image/jpeg' });
    const result = await validateFileType(file, ['image/jpeg']);
    expect(result).toEqual({ valid: true, detectedType: 'image/jpeg' });
  });
});
