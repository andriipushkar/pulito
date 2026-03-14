import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPublication, getPublications, publishNow, updatePublication, deletePublication, PublicationError } from './publication';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    publication: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    publicationImage: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    publicationChannel: {
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

const mockEnv: Record<string, string> = {
  INSTAGRAM_ACCESS_TOKEN: '',
  INSTAGRAM_BUSINESS_ACCOUNT_ID: '',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHANNEL_ID: '',
  FACEBOOK_PAGE_ACCESS_TOKEN: '',
  FACEBOOK_PAGE_ID: '',
};

vi.mock('@/config/env', () => ({
  env: new Proxy({} as Record<string, string>, {
    get: (_target, prop: string) => mockEnv[prop] ?? '',
    set: (_target, prop: string, value: string) => { mockEnv[prop] = value; return true; },
  }),
}));

vi.mock('@/services/instagram', () => ({
  publishImagePost: vi.fn(),
  publishReelsPost: vi.fn(),
  postFirstComment: vi.fn(),
}));

const mockChannelConfigs: Record<string, Record<string, unknown> | null> = {
  telegram: null,
  viber: null,
  facebook: null,
  instagram: null,
};

vi.mock('@/services/channel-config', () => ({
  getChannelConfig: vi.fn((channel: string) => Promise.resolve(mockChannelConfigs[channel])),
}));

import { prisma } from '@/lib/prisma';
import type { MockPrismaClient } from '@/test/prisma-mock';

const mockPrisma = prisma as unknown as MockPrismaClient;
const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = mockFetch;
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
  // Reset channel configs
  mockChannelConfigs.telegram = null;
  mockChannelConfigs.viber = null;
  mockChannelConfigs.facebook = null;
  mockChannelConfigs.instagram = null;
});

describe('createPublication', () => {
  it('should create a draft publication', async () => {
    const input = { title: 'Test', content: 'Content', channels: ['telegram'] };
    mockPrisma.publication.create.mockResolvedValue({ id: 1, status: 'draft', ...input } as never);

    const result = await createPublication(input, 1);

    expect(result.status).toBe('draft');
    expect(mockPrisma.publication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Test',
        content: 'Content',
        channels: ['telegram'],
        status: 'draft',
        createdBy: 1,
      }),
    });
  });

  it('should create a scheduled publication when scheduledAt is provided', async () => {
    const input = {
      title: 'Scheduled',
      content: 'Content',
      channels: ['telegram'],
      scheduledAt: '2026-03-01T12:00:00Z',
    };
    mockPrisma.publication.create.mockResolvedValue({ id: 1, status: 'scheduled' } as never);

    await createPublication(input, 1);

    expect(mockPrisma.publication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'scheduled' }),
    });
  });

  it('should pass optional fields', async () => {
    const input = {
      title: 'Test',
      content: 'Content',
      channels: ['telegram', 'viber'],
      hashtags: '#test',
      imagePath: '/images/test.jpg',
      productId: 5,
      buttons: [{ text: 'Buy', url: 'https://example.com' }],
    };
    mockPrisma.publication.create.mockResolvedValue({ id: 1 } as never);

    await createPublication(input, 1);

    expect(mockPrisma.publication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hashtags: '#test',
        imagePath: '/images/test.jpg',
        productId: 5,
        buttons: [{ text: 'Buy', url: 'https://example.com' }],
      }),
    });
  });
});

describe('getPublications', () => {
  it('should return paginated publications', async () => {
    mockPrisma.publication.findMany.mockResolvedValue([{ id: 1 }] as never);
    mockPrisma.publication.count.mockResolvedValue(1);

    const result = await getPublications();
    expect(result).toEqual({ publications: [{ id: 1 }], total: 1 });
  });

  it('should filter by status', async () => {
    mockPrisma.publication.findMany.mockResolvedValue([] as never);
    mockPrisma.publication.count.mockResolvedValue(0);

    await getPublications({ status: 'draft' });

    expect(mockPrisma.publication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'draft' } })
    );
  });

  it('should paginate correctly', async () => {
    mockPrisma.publication.findMany.mockResolvedValue([] as never);
    mockPrisma.publication.count.mockResolvedValue(0);

    await getPublications({ page: 2, limit: 5 });

    expect(mockPrisma.publication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 })
    );
  });
});

describe('publishNow', () => {
  it('should throw 404 for non-existent publication', async () => {
    mockPrisma.publication.findUnique.mockResolvedValue(null);
    await expect(publishNow(999)).rejects.toThrow(PublicationError);
    await expect(publishNow(999)).rejects.toThrow('Публікацію не знайдено');
  });

  it('should publish to Telegram when configured', async () => {
    mockChannelConfigs.telegram = { enabled: true, botToken: 'test-token', channelId: '@test' };

    mockPrisma.publication.findUnique.mockResolvedValue({
      id: 1,
      title: 'Test',
      content: 'Content',
      channels: ['telegram'],
      hashtags: '#test',
      buttons: null,
    } as never);
    mockPrisma.publication.update.mockResolvedValue({ id: 1, status: 'published' } as never);

    await publishNow(1);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockPrisma.publication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: 'published' }),
      })
    );
  });

  it('should publish to Viber when configured', async () => {
    mockChannelConfigs.viber = { enabled: true, authToken: 'test-viber-token' };

    mockPrisma.publication.findUnique.mockResolvedValue({
      id: 2,
      title: 'Test',
      content: 'Content',
      channels: ['viber'],
      hashtags: null,
      buttons: null,
    } as never);
    mockPrisma.publication.update.mockResolvedValue({ id: 2, status: 'published' } as never);

    await publishNow(2);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://chatapi.viber.com/pa/broadcast_message',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should update status to published', async () => {
    mockPrisma.publication.findUnique.mockResolvedValue({
      id: 1,
      title: 'Test',
      content: 'Content',
      channels: [],
      hashtags: null,
      buttons: null,
    } as never);
    mockPrisma.publication.update.mockResolvedValue({ id: 1, status: 'published' } as never);

    const result = await publishNow(1);
    expect(result.status).toBe('published');
  });

  it('should publish with Telegram buttons when provided', async () => {
    mockChannelConfigs.telegram = { enabled: true, botToken: 'test-token', channelId: '@test' };

    mockPrisma.publication.findUnique.mockResolvedValue({
      id: 1,
      title: 'Test',
      content: 'Content',
      channels: ['telegram'],
      hashtags: null,
      buttons: [{ text: 'Buy', url: 'https://example.com' }],
    } as never);
    mockPrisma.publication.update.mockResolvedValue({ id: 1, status: 'published' } as never);

    await publishNow(1);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.reply_markup).toBeDefined();
    expect(body.reply_markup.inline_keyboard[0][0].text).toBe('Buy');
  });

  it('should handle Telegram publish error gracefully', async () => {
    mockChannelConfigs.telegram = { enabled: true, botToken: 'test-token', channelId: '@test' };

    mockPrisma.publication.findUnique.mockResolvedValue({
      id: 1,
      title: 'Test',
      content: 'Content',
      channels: ['telegram'],
      hashtags: null,
      buttons: null,
    } as never);
    mockPrisma.publication.update.mockResolvedValue({ id: 1, status: 'published' } as never);
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    // Should not throw
    const result = await publishNow(1);
    expect(result.status).toBe('published');
  });

  it('should handle Viber publish error gracefully', async () => {
    mockChannelConfigs.viber = { enabled: true, authToken: 'test-viber-token' };

    mockPrisma.publication.findUnique.mockResolvedValue({
      id: 1,
      title: 'Test',
      content: 'Content',
      channels: ['viber'],
      hashtags: null,
      buttons: null,
    } as never);
    mockPrisma.publication.update.mockResolvedValue({ id: 1, status: 'published' } as never);
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await publishNow(1);
    expect(result.status).toBe('published');
  });

  it('should publish to Instagram with image', async () => {
    mockChannelConfigs.instagram = { enabled: true, accessToken: 'ig-token', businessAccountId: 'ig-account' };

    const { publishImagePost } = await import('@/services/instagram');
    vi.mocked(publishImagePost).mockResolvedValue({ igMediaId: 'media_1', igPermalink: 'https://ig.com/p/1' });

    mockPrisma.publication.findUnique.mockResolvedValue({
      id: 1,
      title: 'IG Test',
      content: 'Content',
      channels: ['instagram'],
      hashtags: '#test',
      imagePath: '/uploads/image.jpg',
      buttons: null,
      firstComment: null,
    } as never);
    (mockPrisma.publicationImage as Record<string, ReturnType<typeof vi.fn>>).findMany.mockResolvedValue([]);
    mockPrisma.publication.update.mockResolvedValue({ id: 1, status: 'published' } as never);

    await publishNow(1);

    expect(publishImagePost).toHaveBeenCalled();
    // update called once for igMediaId and once for status
    expect(mockPrisma.publication.update).toHaveBeenCalledTimes(2);

    // Reset
    mockChannelConfigs.instagram = null;
  });

  it('should publish to Instagram as Reels with video', async () => {
    mockChannelConfigs.instagram = { enabled: true, accessToken: 'ig-token', businessAccountId: 'ig-account' };

    const { publishReelsPost } = await import('@/services/instagram');
    vi.mocked(publishReelsPost).mockResolvedValue({ igMediaId: 'media_2', igPermalink: 'https://ig.com/p/2' });

    mockPrisma.publication.findUnique.mockResolvedValue({
      id: 2,
      title: 'Reels Test',
      content: 'Content',
      channels: ['instagram'],
      hashtags: null,
      imagePath: null,
      buttons: null,
      firstComment: null,
    } as never);
    (mockPrisma.publicationImage as Record<string, ReturnType<typeof vi.fn>>).findMany.mockResolvedValue([
      { imagePath: '/uploads/video.mp4', sortOrder: 0 },
      { imagePath: '/uploads/cover.jpg', sortOrder: 1 },
    ]);
    mockPrisma.publication.update.mockResolvedValue({ id: 2, status: 'published' } as never);

    await publishNow(2);

    expect(publishReelsPost).toHaveBeenCalledWith(
      expect.stringContaining('/uploads/video.mp4'),
      expect.any(String),
      expect.stringContaining('/uploads/cover.jpg')
    );

    mockChannelConfigs.instagram = null;
  });

  it('should post first comment on Instagram if configured', async () => {
    mockChannelConfigs.instagram = { enabled: true, accessToken: 'ig-token', businessAccountId: 'ig-account' };

    const { publishImagePost, postFirstComment } = await import('@/services/instagram');
    vi.mocked(publishImagePost).mockResolvedValue({ igMediaId: 'media_3', igPermalink: 'https://ig.com/p/3' });
    vi.mocked(postFirstComment).mockResolvedValue(undefined as never);

    mockPrisma.publication.findUnique.mockResolvedValue({
      id: 3,
      title: 'IG Comment Test',
      content: 'Content',
      channels: ['instagram'],
      hashtags: null,
      imagePath: '/uploads/img.jpg',
      buttons: null,
      firstComment: 'First comment text!',
    } as never);
    (mockPrisma.publicationImage as Record<string, ReturnType<typeof vi.fn>>).findMany.mockResolvedValue([]);
    mockPrisma.publication.update.mockResolvedValue({ id: 3, status: 'published' } as never);

    await publishNow(3);

    expect(postFirstComment).toHaveBeenCalledWith('media_3', 'First comment text!');

    mockChannelConfigs.instagram = null;
  });

  it('should handle Instagram first comment error gracefully', async () => {
    mockChannelConfigs.instagram = { enabled: true, accessToken: 'ig-token', businessAccountId: 'ig-account' };

    const { publishImagePost, postFirstComment } = await import('@/services/instagram');
    vi.mocked(publishImagePost).mockResolvedValue({ igMediaId: 'media_4', igPermalink: 'https://ig.com/p/4' });
    vi.mocked(postFirstComment).mockRejectedValue(new Error('Comment failed'));

    mockPrisma.publication.findUnique.mockResolvedValue({
      id: 4,
      title: 'IG Comment Fail',
      content: 'Content',
      channels: ['instagram'],
      hashtags: null,
      imagePath: '/uploads/img.jpg',
      buttons: null,
      firstComment: 'Comment',
    } as never);
    (mockPrisma.publicationImage as Record<string, ReturnType<typeof vi.fn>>).findMany.mockResolvedValue([]);
    mockPrisma.publication.update.mockResolvedValue({ id: 4, status: 'published' } as never);

    // Should not throw
    await publishNow(4);

    mockChannelConfigs.instagram = null;
  });

  it('should handle Instagram publish error gracefully', async () => {
    mockChannelConfigs.instagram = { enabled: true, accessToken: 'ig-token', businessAccountId: 'ig-account' };

    const { publishImagePost } = await import('@/services/instagram');
    vi.mocked(publishImagePost).mockRejectedValue(new Error('IG API Error'));

    mockPrisma.publication.findUnique.mockResolvedValue({
      id: 5,
      title: 'IG Fail',
      content: 'Content',
      channels: ['instagram'],
      hashtags: null,
      imagePath: '/uploads/img.jpg',
      buttons: null,
      firstComment: null,
    } as never);
    (mockPrisma.publicationImage as Record<string, ReturnType<typeof vi.fn>>).findMany.mockResolvedValue([]);
    mockPrisma.publication.update.mockResolvedValue({ id: 5, status: 'published' } as never);

    // Should not throw
    await publishNow(5);

    mockChannelConfigs.instagram = null;
  });

  it('should skip Instagram image post when no imageUrl and no video', async () => {
    mockChannelConfigs.instagram = { enabled: true, accessToken: 'ig-token', businessAccountId: 'ig-account' };

    const { publishImagePost, publishReelsPost } = await import('@/services/instagram');

    mockPrisma.publication.findUnique.mockResolvedValue({
      id: 7,
      title: 'No Image IG',
      content: 'Content',
      channels: ['instagram'],
      hashtags: null,
      imagePath: null, // no image
      buttons: null,
      firstComment: null,
    } as never);
    (mockPrisma.publicationImage as Record<string, ReturnType<typeof vi.fn>>).findMany.mockResolvedValue([]); // no video
    mockPrisma.publication.update.mockResolvedValue({ id: 7, status: 'published' } as never);

    await publishNow(7);

    // Neither publishImagePost nor publishReelsPost should be called
    expect(publishImagePost).not.toHaveBeenCalled();
    expect(publishReelsPost).not.toHaveBeenCalled();
    // Only the final status update, no igMediaId update
    expect(mockPrisma.publication.update).toHaveBeenCalledTimes(1);

    mockChannelConfigs.instagram = null;
  });

  it('should use APP_URL from process.env when set', async () => {
    vi.stubEnv('APP_URL', 'https://example.com');

    mockPrisma.publication.findUnique.mockResolvedValue({
      id: 8,
      title: 'Test',
      content: 'Content',
      channels: [],
      hashtags: null,
      buttons: null,
    } as never);
    mockPrisma.publication.update.mockResolvedValue({ id: 8, status: 'published' } as never);

    await publishNow(8);

    expect(mockPrisma.publication.update).toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('should fallback to localhost when APP_URL not set', async () => {
    const originalAppUrl = process.env.APP_URL;
    delete process.env.APP_URL;

    mockPrisma.publication.findUnique.mockResolvedValue({
      id: 9,
      title: 'Test',
      content: 'Content',
      channels: [],
      hashtags: null,
      buttons: null,
    } as never);
    mockPrisma.publication.update.mockResolvedValue({ id: 9, status: 'published' } as never);

    await publishNow(9);

    expect(mockPrisma.publication.update).toHaveBeenCalled();
    if (originalAppUrl !== undefined) process.env.APP_URL = originalAppUrl;
  });

  it('should publish Reels without cover image', async () => {
    mockChannelConfigs.instagram = { enabled: true, accessToken: 'ig-token', businessAccountId: 'ig-account' };

    const { publishReelsPost } = await import('@/services/instagram');
    vi.mocked(publishReelsPost).mockResolvedValue({ igMediaId: 'media_5', igPermalink: 'https://ig.com/p/5' });

    mockPrisma.publication.findUnique.mockResolvedValue({
      id: 6,
      title: 'Reels No Cover',
      content: 'Content',
      channels: ['instagram'],
      hashtags: null,
      imagePath: null,
      buttons: null,
      firstComment: null,
    } as never);
    (mockPrisma.publicationImage as Record<string, ReturnType<typeof vi.fn>>).findMany.mockResolvedValue([
      { imagePath: '/uploads/video.mov', sortOrder: 0 },
    ]);
    mockPrisma.publication.update.mockResolvedValue({ id: 6, status: 'published' } as never);

    await publishNow(6);

    expect(publishReelsPost).toHaveBeenCalledWith(
      expect.stringContaining('/uploads/video.mov'),
      expect.any(String),
      undefined
    );

    mockChannelConfigs.instagram = null;
  });
});

describe('PublicationError', () => {
  it('should create error with default status code', () => {
    const err = new PublicationError('test');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('PublicationError');
  });

  it('should create error with custom status code', () => {
    const err = new PublicationError('not found', 404);
    expect(err.statusCode).toBe(404);
  });
});

describe('updatePublication', () => {
  it('should throw 404 when publication not found', async () => {
    mockPrisma.publication.findUnique.mockResolvedValue(null);
    await expect(updatePublication(999, { title: 'New' })).rejects.toThrow(PublicationError);
  });

  it('should update only provided fields', async () => {
    mockPrisma.publication.findUnique.mockResolvedValue({ id: 1 } as never);
    mockPrisma.publication.update.mockResolvedValue({ id: 1 } as never);

    await updatePublication(1, { title: 'Updated Title', content: 'New content' });

    expect(mockPrisma.publication.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ title: 'Updated Title', content: 'New content' }),
    });
  });

  it('should update valid status', async () => {
    mockPrisma.publication.findUnique.mockResolvedValue({ id: 1 } as never);
    mockPrisma.publication.update.mockResolvedValue({ id: 1, status: 'published' } as never);

    await updatePublication(1, { status: 'published' });

    expect(mockPrisma.publication.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ status: 'published' }),
    });
  });

  it('should ignore invalid status', async () => {
    mockPrisma.publication.findUnique.mockResolvedValue({ id: 1 } as never);
    mockPrisma.publication.update.mockResolvedValue({ id: 1 } as never);

    await updatePublication(1, { status: 'invalid_status' });

    const updateCall = mockPrisma.publication.update.mock.calls[0][0];
    expect(updateCall.data.status).toBeUndefined();
  });

  it('should handle scheduledAt null correctly', async () => {
    mockPrisma.publication.findUnique.mockResolvedValue({ id: 1 } as never);
    mockPrisma.publication.update.mockResolvedValue({ id: 1 } as never);

    await updatePublication(1, { scheduledAt: '' });

    const updateCall = mockPrisma.publication.update.mock.calls[0][0];
    expect(updateCall.data.scheduledAt).toBeNull();
  });

  it('should handle scheduledAt with value', async () => {
    mockPrisma.publication.findUnique.mockResolvedValue({ id: 1 } as never);
    mockPrisma.publication.update.mockResolvedValue({ id: 1 } as never);

    await updatePublication(1, { scheduledAt: '2026-06-01T12:00:00Z' });

    const updateCall = mockPrisma.publication.update.mock.calls[0][0];
    expect(updateCall.data.scheduledAt).toEqual(new Date('2026-06-01T12:00:00Z'));
  });

  it('should update channels, hashtags, imagePath', async () => {
    mockPrisma.publication.findUnique.mockResolvedValue({ id: 1 } as never);
    mockPrisma.publication.update.mockResolvedValue({ id: 1 } as never);

    await updatePublication(1, {
      channels: ['telegram', 'viber'],
      hashtags: '#new',
      imagePath: '/new.jpg',
    });

    const updateCall = mockPrisma.publication.update.mock.calls[0][0];
    expect(updateCall.data.channels).toEqual(['telegram', 'viber']);
    expect(updateCall.data.hashtags).toBe('#new');
    expect(updateCall.data.imagePath).toBe('/new.jpg');
  });
});

describe('deletePublication', () => {
  it('should throw 404 when publication not found', async () => {
    mockPrisma.publication.findUnique.mockResolvedValue(null);
    await expect(deletePublication(999)).rejects.toThrow(PublicationError);
  });

  it('should throw when trying to delete published publication', async () => {
    mockPrisma.publication.findUnique.mockResolvedValue({ id: 1, status: 'published' } as never);
    await expect(deletePublication(1)).rejects.toThrow('Не можна видалити опубліковану публікацію');
  });

  it('should delete draft publication', async () => {
    mockPrisma.publication.findUnique.mockResolvedValue({ id: 1, status: 'draft' } as never);
    (mockPrisma.publication as Record<string, ReturnType<typeof vi.fn>>).delete.mockResolvedValue({} as never);

    await deletePublication(1);

    expect((mockPrisma.publication as Record<string, ReturnType<typeof vi.fn>>).delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
