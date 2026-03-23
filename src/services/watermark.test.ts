import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('sharp', () => {
  const mockSharp = {
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    composite: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue({}),
  };
  return { default: vi.fn(() => mockSharp) };
});

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
  },
}));

import { applyWatermark } from './watermark';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('applyWatermark', () => {
  it('should apply watermark and return _wm path', async () => {
    const fs = (await import('fs/promises')).default;
    // Simulate file not existing (so watermark gets created)
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

    const result = await applyWatermark('/uploads/image.jpg');

    expect(result).toBe('/uploads/image_wm.jpg');
  });

  it('should return existing watermarked path if already exists', async () => {
    const fs = (await import('fs/promises')).default;
    // Simulate file already existing
    vi.mocked(fs.access).mockResolvedValue(undefined);

    const result = await applyWatermark('/uploads/photo.png');

    expect(result).toBe('/uploads/photo_wm.png');
  });

  it('should create SVG watermark with correct dimensions', async () => {
    const fs = (await import('fs/promises')).default;
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
    const sharp = (await import('sharp')).default;

    await applyWatermark('/uploads/test.jpg');

    const sharpInstance = (sharp as any)();
    expect(sharpInstance.composite).toHaveBeenCalledWith([
      expect.objectContaining({
        input: expect.any(Buffer),
        gravity: 'southeast',
      }),
    ]);
  });

  it('should scale font size based on image width', async () => {
    const fs = (await import('fs/promises')).default;
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
    const sharp = (await import('sharp')).default;
    const sharpInstance = (sharp as any)();
    vi.mocked(sharpInstance.metadata).mockResolvedValue({ width: 2000, height: 1500 });

    await applyWatermark('/uploads/big.jpg');

    // fontSize should be max(16, floor(2000 * 0.04)) = 80
    const compositeCall = sharpInstance.composite.mock.calls[0][0][0];
    const svgContent = compositeCall.input.toString();
    expect(svgContent).toContain('font-size: 80px');
  });

  it('should use minimum font size of 16 for small images', async () => {
    const fs = (await import('fs/promises')).default;
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
    const sharp = (await import('sharp')).default;
    const sharpInstance = (sharp as any)();
    vi.mocked(sharpInstance.metadata).mockResolvedValue({ width: 100, height: 100 });

    await applyWatermark('/uploads/tiny.jpg');

    const compositeCall = sharpInstance.composite.mock.calls[0][0][0];
    const svgContent = compositeCall.input.toString();
    expect(svgContent).toContain('font-size: 16px');
  });

  it('should handle images with undefined metadata', async () => {
    const fs = (await import('fs/promises')).default;
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
    const sharp = (await import('sharp')).default;
    const sharpInstance = (sharp as any)();
    vi.mocked(sharpInstance.metadata).mockResolvedValue({});

    await applyWatermark('/uploads/unknown.jpg');

    // Should use defaults (800x600)
    const compositeCall = sharpInstance.composite.mock.calls[0][0][0];
    const svgContent = compositeCall.input.toString();
    expect(svgContent).toContain('width="800"');
    expect(svgContent).toContain('height="600"');
  });

  it('should position watermark text in bottom-right corner', async () => {
    const fs = (await import('fs/promises')).default;
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
    const sharp = (await import('sharp')).default;
    const sharpInstance = (sharp as any)();
    vi.mocked(sharpInstance.metadata).mockResolvedValue({ width: 800, height: 600 });

    await applyWatermark('/uploads/test.jpg');

    const compositeCall = sharpInstance.composite.mock.calls[0][0][0];
    const svgContent = compositeCall.input.toString();
    expect(svgContent).toContain('text-anchor="end"');
    expect(svgContent).toContain('rgba(255, 255, 255, 0.6)');
  });

  it('should handle different file extensions', async () => {
    const fs = (await import('fs/promises')).default;
    vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

    const resultPng = await applyWatermark('/uploads/img.png');
    expect(resultPng).toBe('/uploads/img_wm.png');

    const resultWebp = await applyWatermark('/uploads/photo.webp');
    expect(resultWebp).toBe('/uploads/photo_wm.webp');
  });
});
