import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { getSettings } from '@/services/settings';

/**
 * Background removal abstraction. Currently uses remove.bg API (free tier:
 * 50 images/month, paid plans for higher volume).
 *
 * Returns a PNG buffer with transparent background, or `null` if the service
 * is not configured / the API call fails. Callers must gracefully handle
 * `null` and fall back to the original buffer.
 *
 * To swap providers (Photoroom, Cloudinary, self-hosted ONNX) — just change
 * the body of removeBackground(); the contract is the same.
 */

const API_URL = 'https://api.remove.bg/v1.0/removebg';

export class BackgroundRemovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackgroundRemovalError';
  }
}

/** Resolve the remove.bg key: admin (DB) value wins, env var is the fallback. */
async function getRemovebgKey(): Promise<string> {
  const settings = await getSettings();
  return settings.removebg_api_key || env.REMOVEBG_API_KEY || '';
}

export async function isBackgroundRemovalEnabled(): Promise<boolean> {
  return !!(await getRemovebgKey());
}

/**
 * Send the image to remove.bg, get back a PNG with alpha channel.
 * @param input  Original image bytes (JPG/PNG/WebP)
 * @param mime   Original mime type (used to pass `image_file` part name)
 * @returns      PNG with transparent background, or `null` on failure
 */
export async function removeBackground(input: Buffer, mime: string): Promise<Buffer | null> {
  const apiKey = await getRemovebgKey();
  if (!apiKey) return null;

  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(input)], { type: mime || 'image/jpeg' });
    form.append('image_file', blob, 'upload');
    form.append('size', 'auto'); // 'auto' returns highest available resolution
    form.append('format', 'png'); // PNG keeps the alpha channel

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn('remove.bg API failed', { status: res.status, body: text.slice(0, 200) });
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    logger.warn('remove.bg API exception', { error: String(err) });
    return null;
  }
}
