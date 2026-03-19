import { describe, it, expect, vi } from 'vitest';

const mockSharpInstance = {
  resize: vi.fn().mockReturnThis(),
  rotate: vi.fn().mockReturnThis(),
  webp: vi.fn().mockReturnThis(),
  toBuffer: vi.fn().mockResolvedValue(Buffer.from('sanitized-webp')),
};

vi.mock('sharp', () => ({
  default: vi.fn(() => mockSharpInstance),
}));

import { sanitizeImage } from './image-sanitizer';

describe('sanitizeImage', () => {
  it('re-encodes image through sharp pipeline', async () => {
    const input = Buffer.from('fake-image-data');
    const result = await sanitizeImage(input);

    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe('sanitized-webp');
  });

  it('resizes with default max width 2048', async () => {
    await sanitizeImage(Buffer.from('test'));

    expect(mockSharpInstance.resize).toHaveBeenCalledWith(2048, 2048, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  });

  it('uses custom max width and quality', async () => {
    await sanitizeImage(Buffer.from('test'), 1024, 70);

    expect(mockSharpInstance.resize).toHaveBeenCalledWith(1024, 1024, {
      fit: 'inside',
      withoutEnlargement: true,
    });
    expect(mockSharpInstance.webp).toHaveBeenCalledWith({ quality: 70 });
  });

  it('auto-rotates based on EXIF before stripping', async () => {
    await sanitizeImage(Buffer.from('test'));
    expect(mockSharpInstance.rotate).toHaveBeenCalled();
  });

  it('outputs WebP format', async () => {
    await sanitizeImage(Buffer.from('test'));
    expect(mockSharpInstance.webp).toHaveBeenCalledWith({ quality: 85 });
  });
});
