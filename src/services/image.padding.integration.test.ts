/**
 * Integration test using REAL sharp — no mocking. Verifies that the new
 * fit:'contain' + PAD_BACKGROUND pipeline produces a true 800×800 (or other
 * target) square for non-square inputs, and that small inputs are enlarged.
 *
 * Mocks only Prisma + storage so we can call processProductImage end-to-end
 * with real image bytes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';

const mockPrisma = vi.hoisted(() => ({
  product: { findUnique: vi.fn(), update: vi.fn() },
  productImage: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
}));

const capturedUploads: { key: string; buffer: Buffer; contentType: string }[] = [];
const mockUploadFile = vi.hoisted(() =>
  vi.fn(async (key: string, buffer: Buffer, contentType: string) => {
    // Push into a closure captured below via setUploadCapture
  }),
);

const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('fs', () => ({
  promises: mockFs,
  default: { existsSync: vi.fn().mockReturnValue(true) },
}));
vi.mock('@/config/env', () => ({ env: { UPLOAD_DIR: '/tmp/test-uploads' } }));
vi.mock('@/utils/file-validation', () => ({
  validateFileType: vi.fn().mockResolvedValue({ valid: true }),
}));
vi.mock('@/lib/storage', () => ({
  uploadFile: mockUploadFile,
  deleteFile: vi.fn(),
  isCloudStorageEnabled: vi.fn().mockReturnValue(true), // route through uploadFile so we can capture
}));
vi.mock('@/services/background-removal', () => ({
  removeBackground: vi.fn(),
  isBackgroundRemovalEnabled: vi.fn(() => false),
}));

import { processProductImage } from './image';

beforeEach(() => {
  capturedUploads.length = 0;
  vi.clearAllMocks();
  mockUploadFile.mockImplementation(async (key, buffer, contentType) => {
    capturedUploads.push({ key, buffer: buffer as Buffer, contentType });
  });
  mockPrisma.product.findUnique.mockResolvedValue({ id: 1, code: 'TEST' });
  mockPrisma.productImage.count.mockResolvedValue(0);
  mockPrisma.productImage.findFirst.mockResolvedValue(null);
  mockPrisma.productImage.create.mockImplementation(async (data: { data: unknown }) => ({
    id: 1,
    ...((data.data as Record<string, unknown>) ?? {}),
  }));
  mockPrisma.product.update.mockResolvedValue({});
});

async function buildJpeg(width: number, height: number, color = '#ff0000'): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  })
    .jpeg()
    .toBuffer();
}

describe('image padding (real Sharp integration)', () => {
  it('A2.1 — square 1024×1024 input → variants are exact 800/400/150 squares', async () => {
    const buf = await buildJpeg(1024, 1024);
    await processProductImage(buf, 'image/jpeg', 'square.jpg', 1);

    // Inspect variant outputs (skip *_original)
    const variants = capturedUploads.filter((u) => !u.key.includes('_original'));
    expect(variants.length).toBe(4);

    for (const v of variants) {
      const meta = await sharp(v.buffer).metadata();
      const expected = v.key.includes('800x800')
        ? 800
        : v.key.includes('400x400')
          ? 400
          : v.key.includes('150x150')
            ? 150
            : 20;
      expect(meta.width).toBe(expected);
      expect(meta.height).toBe(expected);
    }
  });

  it('A2.2 — landscape 1024×600 input → variants are still exact squares with padding', async () => {
    const buf = await buildJpeg(1024, 600, '#00ff00');
    await processProductImage(buf, 'image/jpeg', 'landscape.jpg', 1);

    const fullVariant = capturedUploads.find((u) => u.key.includes('800x800'))!;
    const meta = await sharp(fullVariant.buffer).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(800);

    // Sample top-center pixel — should be PAD_BACKGROUND (#f5f5f5 ≈ 245,245,245).
    const { data, info } = await sharp(fullVariant.buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Top row, middle x — should be padding.
    const topMidPixel = Math.floor(info.width / 2) * info.channels;
    const r = data[topMidPixel];
    expect(r).toBeGreaterThanOrEqual(240);
    expect(r).toBeLessThanOrEqual(250);
  });

  it('A2.3 — portrait 600×1024 input → square output with horizontal padding', async () => {
    const buf = await buildJpeg(600, 1024, '#0000ff');
    await processProductImage(buf, 'image/jpeg', 'portrait.jpg', 1);

    const fullVariant = capturedUploads.find((u) => u.key.includes('800x800'))!;
    const meta = await sharp(fullVariant.buffer).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(800);

    // Sample left-edge pixel mid-height — should be padding.
    const { data, info } = await sharp(fullVariant.buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const midY = Math.floor(info.height / 2);
    const offset = midY * info.width * info.channels; // x=0, y=midY
    const r = data[offset];
    expect(r).toBeGreaterThanOrEqual(240);
    expect(r).toBeLessThanOrEqual(250);
  });

  it('A2.4 — small 350×350 image is enlarged to 800×800 canvas', async () => {
    const buf = await buildJpeg(350, 350);
    await processProductImage(buf, 'image/jpeg', 'small.jpg', 1);

    const fullVariant = capturedUploads.find((u) => u.key.includes('800x800'))!;
    const meta = await sharp(fullVariant.buffer).metadata();
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(800);
  });

  it('A2.5 — undersized (<300px) image is rejected', async () => {
    const buf = await buildJpeg(250, 250);
    await expect(processProductImage(buf, 'image/jpeg', 'tiny.jpg', 1)).rejects.toThrow(
      'Мінімальний розмір фото',
    );
  });
});
