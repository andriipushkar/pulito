import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}));

vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('test-content')),
  },
}));

vi.mock('@/config/env', () => ({
  env: {
    UPLOAD_DIR: '/tmp/test-uploads',
    APP_URL: 'http://localhost:3000',
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars-required-here',
    JWT_ALGORITHM: 'HS256',
    JWT_PRIVATE_KEY_PATH: '',
    JWT_PUBLIC_KEY_PATH: '',
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Reset R2 env vars (disabled by default)
  delete process.env.R2_ACCOUNT_ID;
  delete process.env.R2_ACCESS_KEY_ID;
  delete process.env.R2_SECRET_ACCESS_KEY;
  delete process.env.R2_BUCKET;
});

describe('storage - local fallback', () => {
  it('uploads file locally when R2 is not configured', async () => {
    // Dynamic import to pick up cleared env
    const { uploadFile } = await import('./storage');
    const { promises: fs } = await import('fs');

    const result = await uploadFile('test/image.webp', Buffer.from('data'), 'image/webp');

    expect(result).toBe('/uploads/test/image.webp');
    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('deletes file locally', async () => {
    const { deleteFile } = await import('./storage');
    const { promises: fs } = await import('fs');

    await deleteFile('test/image.webp');
    expect(fs.unlink).toHaveBeenCalled();
  });

  it('reads file locally', async () => {
    const { readFile } = await import('./storage');

    const result = await readFile('test/image.webp');
    expect(result).toBeInstanceOf(Buffer);
  });

  it('reports cloud storage as disabled', async () => {
    const { isCloudStorageEnabled } = await import('./storage');
    expect(isCloudStorageEnabled()).toBe(false);
  });
});
