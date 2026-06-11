import { getChannelConfig } from '@/services/channel-config';
import { logger } from '@/lib/logger';

/**
 * TikTok Content Posting API (photo direct post).
 * Docs: https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
 *
 * Caveats that surface as API errors, not code bugs:
 * - the app must have the video.publish scope approved;
 * - unaudited TikTok apps can only post with privacy SELF_ONLY;
 * - PULL_FROM_URL requires verifying the image-domain ownership in the
 *   TikTok developer portal (otherwise url_ownership_unverified).
 */

const API_BASE = 'https://open.tiktokapis.com';
const TITLE_MAX = 90; // UTF-16 runes
const DESCRIPTION_MAX = 4000;
const MAX_PHOTOS = 35;

export class TikTokError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'TikTokError';
    this.statusCode = statusCode;
  }
}

export interface TikTokPublishResult {
  publishId: string;
}

/**
 * Publish a photo post (single image or carousel) to the connected TikTok
 * account. Returns the publish_id TikTok processes asynchronously — there is
 * no permalink at submit time.
 */
export async function publishPhotoPost(
  imageUrls: string[],
  title: string,
  description: string,
): Promise<TikTokPublishResult> {
  const config = await getChannelConfig('tiktok');
  if (!config?.enabled || !config.accessToken) {
    throw new TikTokError('TikTok канал не налаштовано', 400);
  }
  if (imageUrls.length === 0) {
    throw new TikTokError('TikTok потребує хоча б одне зображення', 400);
  }

  const res = await fetch(`${API_BASE}/v2/post/publish/content/init/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      media_type: 'PHOTO',
      post_mode: 'DIRECT_POST',
      post_info: {
        title: title.slice(0, TITLE_MAX),
        description: description.slice(0, DESCRIPTION_MAX),
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_comment: false,
        auto_add_music: true,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_images: imageUrls.slice(0, MAX_PHOTOS),
        photo_cover_index: 0,
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  const data = (await res.json()) as {
    data?: { publish_id?: string };
    error?: { code?: string; message?: string; log_id?: string };
  };

  if (!res.ok || (data.error && data.error.code !== 'ok') || !data.data?.publish_id) {
    const message = data.error?.message || `TikTok API error (HTTP ${res.status})`;
    logger.error('[tiktok] photo publish failed', {
      status: res.status,
      code: data.error?.code,
      logId: data.error?.log_id,
    });
    throw new TikTokError(message, res.status >= 400 && res.status < 500 ? res.status : 502);
  }

  return { publishId: data.data.publish_id };
}
