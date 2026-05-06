import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  product: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
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

const mockSharp = vi.hoisted(() => {
  const instance = {
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    resize: vi.fn().mockReturnThis(),
    blur: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
    toFile: vi.fn().mockResolvedValue({}),
  };
  const fn = vi.fn(() => instance);
  (fn as unknown as Record<string, unknown>)._instance = instance;
  return fn;
});

const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
}));

const mockValidateFileType = vi.hoisted(() => vi.fn().mockResolvedValue({ valid: true }));

const mockUploadFile = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockDeleteFile = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockIsCloudStorageEnabled = vi.hoisted(() => vi.fn().mockReturnValue(false));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('sharp', () => ({ default: mockSharp }));
vi.mock('fs', () => ({
  promises: mockFs,
  default: { existsSync: vi.fn().mockReturnValue(true), readFileSync: vi.fn() },
}));
vi.mock('@/config/env', () => ({
  env: { UPLOAD_DIR: '/tmp/test-uploads' },
}));
vi.mock('@/utils/file-validation', () => ({
  validateFileType: mockValidateFileType,
}));
vi.mock('@/lib/storage', () => ({
  uploadFile: mockUploadFile,
  deleteFile: mockDeleteFile,
  isCloudStorageEnabled: mockIsCloudStorageEnabled,
}));

const mockRemoveBackground = vi.hoisted(() => vi.fn());
const mockIsBgEnabled = vi.hoisted(() => vi.fn(() => false));
vi.mock('@/services/background-removal', () => ({
  removeBackground: mockRemoveBackground,
  isBackgroundRemovalEnabled: mockIsBgEnabled,
}));

import {
  processProductImage,
  deleteProductImage,
  matchImagesFromDirectory,
  ImageError,
} from './image';

beforeEach(() => {
  vi.clearAllMocks();
  mockIsCloudStorageEnabled.mockReturnValue(false);
  mockValidateFileType.mockResolvedValue({ valid: true });
  (mockSharp as unknown as Record<string, unknown>)._instance = undefined;
  const instance = {
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    resize: vi.fn().mockReturnThis(),
    blur: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
  };
  Object.assign(instance, { flatten: vi.fn().mockReturnThis() });
  mockSharp.mockReturnValue(instance as never);
});

describe('processProductImage', () => {
  const fakeBuffer = Buffer.alloc(1024, 0xff);
  const productMock = { id: 1, code: 'TEST-001' };

  beforeEach(() => {
    mockPrisma.product.findUnique.mockResolvedValue(productMock);
    mockPrisma.productImage.count.mockResolvedValue(0);
    mockPrisma.productImage.findFirst.mockResolvedValue(null);
    mockPrisma.productImage.create.mockResolvedValue({ id: 1 });
    mockPrisma.productImage.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.product.update.mockResolvedValue({});
  });

  it('should process a valid JPEG image', async () => {
    const result = await processProductImage(fakeBuffer, 'image/jpeg', 'photo.jpg', 1);

    expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true, code: true },
    });
    expect(mockFs.mkdir).toHaveBeenCalled();
    expect(mockPrisma.productImage.create).toHaveBeenCalled();
    expect(result).toEqual({ id: 1 });
  });

  it('should process a valid PNG image', async () => {
    await processProductImage(fakeBuffer, 'image/png', 'photo.png', 1);
    expect(mockPrisma.productImage.create).toHaveBeenCalled();
  });

  it('should process a valid WebP image', async () => {
    await processProductImage(fakeBuffer, 'image/webp', 'photo.webp', 1);
    expect(mockPrisma.productImage.create).toHaveBeenCalled();
  });

  it('should reject unsupported image formats', async () => {
    await expect(processProductImage(fakeBuffer, 'image/gif', 'anim.gif', 1)).rejects.toThrow(
      ImageError,
    );
    await expect(processProductImage(fakeBuffer, 'image/gif', 'anim.gif', 1)).rejects.toThrow(
      'Непідтримуваний формат',
    );
  });

  it('should reject files exceeding 5MB', async () => {
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
    await expect(processProductImage(largeBuffer, 'image/jpeg', 'big.jpg', 1)).rejects.toThrow(
      'Максимальний розмір файлу: 5 МБ',
    );
  });

  it('should reject files that fail content validation', async () => {
    mockValidateFileType.mockResolvedValueOnce({ valid: false });
    await expect(processProductImage(fakeBuffer, 'image/jpeg', 'fake.jpg', 1)).rejects.toThrow(
      'Вміст файлу не відповідає заявленому формату',
    );
  });

  it('should reject images smaller than 300×300 (A1)', async () => {
    const smallInstance = {
      metadata: vi.fn().mockResolvedValue({ width: 200, height: 200 }),
      resize: vi.fn().mockReturnThis(),
      blur: vi.fn().mockReturnThis(),
      webp: vi.fn().mockReturnThis(),
      flatten: vi.fn().mockReturnThis(),
      composite: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('x')),
    };
    mockSharp.mockReturnValue(smallInstance as never);
    await expect(processProductImage(fakeBuffer, 'image/jpeg', 'tiny.jpg', 1)).rejects.toThrow(
      'Мінімальний розмір фото: 300×300 px',
    );
  });

  it('should accept exactly 300×300 image', async () => {
    const minInstance = {
      metadata: vi.fn().mockResolvedValue({ width: 300, height: 300 }),
      resize: vi.fn().mockReturnThis(),
      blur: vi.fn().mockReturnThis(),
      webp: vi.fn().mockReturnThis(),
      flatten: vi.fn().mockReturnThis(),
      composite: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('x')),
    };
    mockSharp.mockReturnValue(minInstance as never);
    await processProductImage(fakeBuffer, 'image/jpeg', 'min.jpg', 1);
    expect(mockPrisma.productImage.create).toHaveBeenCalled();
  });

  it('falls back to padding when removeBg=true but service returns null (A3)', async () => {
    mockIsBgEnabled.mockReturnValue(true);
    mockRemoveBackground.mockResolvedValueOnce(null);
    await processProductImage(fakeBuffer, 'image/jpeg', 'p.jpg', 1, false, { removeBg: true });
    // image still saved despite BG removal failure
    expect(mockPrisma.productImage.create).toHaveBeenCalled();
    // service was attempted
    expect(mockRemoveBackground).toHaveBeenCalled();
  });

  it('skips background removal when service is disabled', async () => {
    mockIsBgEnabled.mockReturnValue(false);
    mockRemoveBackground.mockClear();
    await processProductImage(fakeBuffer, 'image/jpeg', 'p.jpg', 1, false, { removeBg: true });
    expect(mockRemoveBackground).not.toHaveBeenCalled();
  });

  it('uses cutout when bg removal succeeds', async () => {
    mockIsBgEnabled.mockReturnValue(true);
    const cutout = Buffer.from('png-with-alpha');
    mockRemoveBackground.mockResolvedValueOnce(cutout);
    await processProductImage(fakeBuffer, 'image/jpeg', 'p.jpg', 1, false, { removeBg: true });
    expect(mockRemoveBackground).toHaveBeenCalledWith(fakeBuffer, 'image/jpeg');
    // Sharp should be invoked with the cutout buffer for variant generation
    const calls = mockSharp.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).toContain(cutout);
  });

  it('should throw 404 when product is not found', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);
    try {
      await processProductImage(fakeBuffer, 'image/jpeg', 'photo.jpg', 999);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ImageError);
      expect((err as ImageError).statusCode).toBe(404);
    }
  });

  it('should auto-set as main when it is the first image', async () => {
    mockPrisma.productImage.count.mockResolvedValue(0);
    await processProductImage(fakeBuffer, 'image/jpeg', 'photo.jpg', 1);

    const createCall = mockPrisma.productImage.create.mock.calls[0][0];
    expect(createCall.data.isMain).toBe(true);
  });

  it('should unset existing main when isMain flag is set', async () => {
    mockPrisma.productImage.count.mockResolvedValue(3);
    await processProductImage(fakeBuffer, 'image/jpeg', 'photo.jpg', 1, true);

    expect(mockPrisma.productImage.updateMany).toHaveBeenCalledWith({
      where: { productId: 1, isMain: true },
      data: { isMain: false },
    });
  });

  it('should calculate correct sort order', async () => {
    mockPrisma.productImage.findFirst.mockResolvedValue({ sortOrder: 4 });
    mockPrisma.productImage.count.mockResolvedValue(5);
    await processProductImage(fakeBuffer, 'image/jpeg', 'photo.jpg', 1);

    const createCall = mockPrisma.productImage.create.mock.calls[0][0];
    expect(createCall.data.sortOrder).toBe(5);
  });

  it('should update product imagePath when image is main', async () => {
    mockPrisma.productImage.count.mockResolvedValue(0);
    await processProductImage(fakeBuffer, 'image/jpeg', 'photo.jpg', 1);

    expect(mockPrisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ imagePath: expect.any(String) }),
      }),
    );
  });

  it('should use cloud storage when enabled', async () => {
    mockIsCloudStorageEnabled.mockReturnValue(true);
    await processProductImage(fakeBuffer, 'image/jpeg', 'photo.jpg', 1);

    expect(mockUploadFile).toHaveBeenCalled();
    expect(mockFs.writeFile).not.toHaveBeenCalled();
  });

  it('should use local storage when cloud is disabled', async () => {
    mockIsCloudStorageEnabled.mockReturnValue(false);
    await processProductImage(fakeBuffer, 'image/jpeg', 'photo.jpg', 1);

    // writeFile is called for original + variants when cloud disabled
    expect(mockFs.writeFile).toHaveBeenCalled();
    expect(mockUploadFile).not.toHaveBeenCalled();
  });
});

describe('deleteProductImage', () => {
  it('should throw 404 when image not found', async () => {
    mockPrisma.productImage.findUnique.mockResolvedValue(null);

    try {
      await deleteProductImage(999);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ImageError);
      expect((err as ImageError).statusCode).toBe(404);
    }
  });

  it('should delete files and DB record', async () => {
    mockPrisma.productImage.findUnique.mockResolvedValue({
      id: 1,
      productId: 10,
      isMain: false,
      pathOriginal: '/uploads/products/test/orig.jpg',
      pathFull: '/uploads/products/test/full.webp',
      pathMedium: '/uploads/products/test/medium.webp',
      pathThumbnail: '/uploads/products/test/thumb.webp',
      pathBlur: '/uploads/products/test/blur.webp',
    });

    await deleteProductImage(1);

    expect(mockPrisma.productImage.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('should promote next image as main when deleting the main image', async () => {
    mockPrisma.productImage.findUnique.mockResolvedValue({
      id: 1,
      productId: 10,
      isMain: true,
      pathOriginal: '/uploads/p/orig.jpg',
      pathFull: null,
      pathMedium: '/uploads/p/medium.webp',
      pathThumbnail: null,
      pathBlur: null,
    });
    mockPrisma.productImage.findFirst.mockResolvedValue({
      id: 2,
      pathMedium: '/uploads/p/medium2.webp',
    });

    await deleteProductImage(1);

    expect(mockPrisma.productImage.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { isMain: true },
    });
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { imagePath: '/uploads/p/medium2.webp' },
    });
  });

  it('should set imagePath to null when deleting the only main image', async () => {
    mockPrisma.productImage.findUnique.mockResolvedValue({
      id: 1,
      productId: 10,
      isMain: true,
      pathOriginal: '/uploads/p/orig.jpg',
      pathFull: null,
      pathMedium: null,
      pathThumbnail: null,
      pathBlur: null,
    });
    mockPrisma.productImage.findFirst.mockResolvedValue(null);

    await deleteProductImage(1);

    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { imagePath: null },
    });
  });

  it('should silently handle file deletion errors', async () => {
    mockPrisma.productImage.findUnique.mockResolvedValue({
      id: 1,
      productId: 10,
      isMain: false,
      pathOriginal: '/uploads/p/orig.jpg',
      pathFull: null,
      pathMedium: null,
      pathThumbnail: null,
      pathBlur: null,
    });
    mockFs.unlink.mockRejectedValue(new Error('ENOENT'));

    // Should not throw
    await deleteProductImage(1);
    expect(mockPrisma.productImage.delete).toHaveBeenCalled();
  });
});

describe('matchImagesFromDirectory', () => {
  it('should return image files from a directory', async () => {
    mockFs.access.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue(['img1.jpg', 'img2.png', 'img3.webp', 'readme.txt'] as never);

    const result = await matchImagesFromDirectory('TEST-001');

    expect(result).toEqual(['img1.jpg', 'img2.png', 'img3.webp']);
  });

  it('should return null when directory does not exist', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT'));

    const result = await matchImagesFromDirectory('NONEXISTENT');

    expect(result).toBeNull();
  });

  it('should filter out non-image files', async () => {
    mockFs.access.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue(['doc.pdf', 'style.css', 'data.json'] as never);

    const result = await matchImagesFromDirectory('TEST-001');

    expect(result).toEqual([]);
  });
});
