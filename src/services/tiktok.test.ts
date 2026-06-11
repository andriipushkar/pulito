import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/channel-config', () => ({
  getChannelConfig: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

import { getChannelConfig } from '@/services/channel-config';
import { publishPhotoPost, TikTokError } from './tiktok';

const mockGetConfig = vi.mocked(getChannelConfig);
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('publishPhotoPost', () => {
  it('throws when the channel is not configured', async () => {
    mockGetConfig.mockResolvedValue({ enabled: false } as never);
    await expect(publishPhotoPost(['https://x/img.webp'], 't', 'd')).rejects.toThrow(TikTokError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts a photo and returns publish_id', async () => {
    mockGetConfig.mockResolvedValue({ enabled: true, accessToken: 'tok', openId: 'o' } as never);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { publish_id: 'p123' }, error: { code: 'ok', message: '' } }),
    });

    const res = await publishPhotoPost(['https://x/img.webp'], 'Назва', 'Опис');

    expect(res.publishId).toBe('p123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://open.tiktokapis.com/v2/post/publish/content/init/');
    const body = JSON.parse(init.body as string);
    expect(body.media_type).toBe('PHOTO');
    expect(body.post_mode).toBe('DIRECT_POST');
    expect(body.source_info.photo_images).toEqual(['https://x/img.webp']);
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('surfaces the TikTok error message on failure', async () => {
    mockGetConfig.mockResolvedValue({ enabled: true, accessToken: 'tok', openId: 'o' } as never);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: { code: 'url_ownership_unverified', message: 'URL ownership not verified' },
      }),
    });

    await expect(publishPhotoPost(['https://x/i.webp'], 't', 'd')).rejects.toThrow(
      'URL ownership not verified',
    );
  });

  it('truncates over-limit title and caps photo count', async () => {
    mockGetConfig.mockResolvedValue({ enabled: true, accessToken: 'tok', openId: 'o' } as never);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { publish_id: 'p1' }, error: { code: 'ok' } }),
    });

    const urls = Array.from({ length: 40 }, (_, i) => `https://x/${i}.webp`);
    await publishPhotoPost(urls, 'а'.repeat(120), 'd');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.post_info.title).toHaveLength(90);
    expect(body.source_info.photo_images).toHaveLength(35);
  });
});
