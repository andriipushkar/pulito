import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import path from 'path';
import { env } from '@/config/env';

/**
 * Unified storage abstraction — uploads go to Cloudflare R2 if configured,
 * otherwise falls back to local filesystem. This lets a $5 VPS offload
 * image serving to Cloudflare's global CDN (free 10GB tier, zero egress fees).
 */

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET = process.env.R2_BUCKET || '';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''; // e.g. https://media.poroshok.com

const isR2Enabled = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

function getLocalUploadDir(): string {
  return env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
}

/**
 * Upload a file to storage. Returns the public URL/path.
 * @param key - The storage key (e.g. "products/p001/image_800x800.webp")
 * @param buffer - File content
 * @param contentType - MIME type
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  if (isR2Enabled) {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : `/uploads/${key}`;
  }

  // Local fallback
  const filePath = path.join(getLocalUploadDir(), key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
  return `/uploads/${key}`;
}

/**
 * Delete a file from storage.
 * @param key - The storage key
 */
export async function deleteFile(key: string): Promise<void> {
  if (isR2Enabled) {
    const client = getS3Client();
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
        })
      );
    } catch {
      // File might not exist
    }
    return;
  }

  // Local fallback
  const filePath = path.join(getLocalUploadDir(), key);
  const uploadDir = getLocalUploadDir();
  // Path traversal check
  if (!filePath.startsWith(uploadDir + path.sep)) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // File might not exist
  }
}

/**
 * Read a file from storage. Returns null if not found.
 */
export async function readFile(key: string): Promise<Buffer | null> {
  if (isR2Enabled) {
    const client = getS3Client();
    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
        })
      );
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }

  // Local fallback
  const filePath = path.join(getLocalUploadDir(), key);
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

/** Check if R2 cloud storage is active */
export function isCloudStorageEnabled(): boolean {
  return isR2Enabled;
}

/** Get the public base URL for stored assets */
export function getPublicBaseUrl(): string {
  if (isR2Enabled && R2_PUBLIC_URL) return R2_PUBLIC_URL;
  return '';
}
