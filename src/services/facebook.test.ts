import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    FACEBOOK_PAGE_ID: 'test-page-id',
    FACEBOOK_PAGE_ACCESS_TOKEN: 'test-access-token',
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import {
  publishTextPost,
  publishPhotoPost,
  publishMultiPhotoPost,
  FacebookError,
} from './facebook';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});

function createFetchResponse(body: object, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: { get: () => null },
  };
}

// ---------------------------------------------------------------------------
// FacebookError
// ---------------------------------------------------------------------------
describe('FacebookError', () => {
  it('should create error with default status code', () => {
    const error = new FacebookError('test');
    expect(error.message).toBe('test');
    expect(error.name).toBe('FacebookError');
    expect(error.statusCode).toBe(400);
  });

  it('should create error with custom status code', () => {
    const error = new FacebookError('rate limit', 429);
    expect(error.statusCode).toBe(429);
  });

  it('should be an instance of Error', () => {
    expect(new FacebookError('test')).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// publishTextPost
// ---------------------------------------------------------------------------
describe('publishTextPost', () => {
  it('should publish a text post and return post ID and permalink', async () => {
    fetchMock.mockResolvedValueOnce(createFetchResponse({ id: '123_456' }));

    const result = await publishTextPost('Hello World');

    expect(result.fbPostId).toBe('123_456');
    expect(result.fbPermalink).toBe('https://www.facebook.com/123/posts/456');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.message).toBe('Hello World');
    expect(body.access_token).toBe('test-access-token');
    expect(body.link).toBeUndefined();
  });

  it('should include link when provided', async () => {
    fetchMock.mockResolvedValueOnce(createFetchResponse({ id: '123_456' }));

    await publishTextPost('Check this out', 'https://example.com');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.link).toBe('https://example.com');
  });

  it('should throw when credentials are missing', async () => {
    const { env } = await import('@/config/env');
    const original = { ...env };
    Object.assign(env, { FACEBOOK_PAGE_ID: '', FACEBOOK_PAGE_ACCESS_TOKEN: '' });

    await expect(publishTextPost('test')).rejects.toThrow('Facebook credentials not configured');

    Object.assign(env, original);
  });

  it('should throw when API returns error', async () => {
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({ error: { message: 'Invalid token', code: 190 } }),
    );

    await expect(publishTextPost('test')).rejects.toThrow('Facebook publish error: Invalid token');
  });

  it('should throw when no post ID returned', async () => {
    fetchMock.mockResolvedValueOnce(createFetchResponse({}));

    await expect(publishTextPost('test')).rejects.toThrow('Facebook publish failed: no post ID returned');
  });
});

// ---------------------------------------------------------------------------
// publishPhotoPost
// ---------------------------------------------------------------------------
describe('publishPhotoPost', () => {
  it('should publish a photo post', async () => {
    fetchMock.mockResolvedValueOnce(createFetchResponse({ post_id: '111_222' }));

    const result = await publishPhotoPost('https://example.com/img.jpg', 'Photo caption');

    expect(result.fbPostId).toBe('111_222');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.url).toBe('https://example.com/img.jpg');
    expect(body.message).toBe('Photo caption');
  });

  it('should use data.id when post_id is not returned', async () => {
    fetchMock.mockResolvedValueOnce(createFetchResponse({ id: '333_444' }));

    const result = await publishPhotoPost('https://example.com/img.jpg', 'Caption');

    expect(result.fbPostId).toBe('333_444');
  });

  it('should throw when credentials are missing', async () => {
    const { env } = await import('@/config/env');
    const original = { ...env };
    Object.assign(env, { FACEBOOK_PAGE_ID: '', FACEBOOK_PAGE_ACCESS_TOKEN: '' });

    await expect(publishPhotoPost('url', 'caption')).rejects.toThrow('Facebook credentials not configured');

    Object.assign(env, original);
  });

  it('should throw on API error', async () => {
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({ error: { message: 'Bad image' } }),
    );

    await expect(publishPhotoPost('url', 'caption')).rejects.toThrow('Facebook photo publish error: Bad image');
  });

  it('should throw when no ID returned', async () => {
    fetchMock.mockResolvedValueOnce(createFetchResponse({}));

    await expect(publishPhotoPost('url', 'caption')).rejects.toThrow('Facebook photo publish failed: no post ID returned');
  });
});

// ---------------------------------------------------------------------------
// publishMultiPhotoPost
// ---------------------------------------------------------------------------
describe('publishMultiPhotoPost', () => {
  it('should publish multi-photo post with unpublished uploads', async () => {
    fetchMock
      // Upload photo 1 unpublished
      .mockResolvedValueOnce(createFetchResponse({ id: 'photo-1' }))
      // Upload photo 2 unpublished
      .mockResolvedValueOnce(createFetchResponse({ id: 'photo-2' }))
      // Create post with attached media
      .mockResolvedValueOnce(createFetchResponse({ id: '999_888' }));

    const result = await publishMultiPhotoPost(
      ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
      'Multi photo post',
    );

    expect(result.fbPostId).toBe('999_888');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Verify unpublished upload
    const upload1Body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(upload1Body.published).toBe(false);

    // Verify post creation with attached_media
    const postBody = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(postBody.attached_media).toEqual([{ media_fbid: 'photo-1' }, { media_fbid: 'photo-2' }]);
    expect(postBody.message).toBe('Multi photo post');
  });

  it('should throw when no images provided', async () => {
    await expect(publishMultiPhotoPost([], 'caption')).rejects.toThrow('At least one image is required');
  });

  it('should delegate to publishPhotoPost for single image', async () => {
    fetchMock.mockResolvedValueOnce(createFetchResponse({ post_id: 'single-photo' }));

    const result = await publishMultiPhotoPost(['https://example.com/one.jpg'], 'Single');

    expect(result.fbPostId).toBe('single-photo');
    // Should only call photos endpoint, not feed
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/photos');
  });

  it('should throw when credentials are missing', async () => {
    const { env } = await import('@/config/env');
    const original = { ...env };
    Object.assign(env, { FACEBOOK_PAGE_ID: '', FACEBOOK_PAGE_ACCESS_TOKEN: '' });

    await expect(
      publishMultiPhotoPost(['https://a.com/1.jpg', 'https://a.com/2.jpg'], 'caption'),
    ).rejects.toThrow('Facebook credentials not configured');

    Object.assign(env, original);
  });

  it('should throw when photo upload fails', async () => {
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({ error: { message: 'Upload error' } }),
    );

    await expect(
      publishMultiPhotoPost(['https://a.com/1.jpg', 'https://a.com/2.jpg'], 'caption'),
    ).rejects.toThrow('Failed to upload photo: Upload error');
  });

  it('should throw with unknown error when upload returns no id and no error', async () => {
    fetchMock.mockResolvedValueOnce(createFetchResponse({}));

    await expect(
      publishMultiPhotoPost(['https://a.com/1.jpg', 'https://a.com/2.jpg'], 'caption'),
    ).rejects.toThrow('Failed to upload photo: Unknown error');
  });

  it('should throw when post creation with attached media fails', async () => {
    fetchMock
      .mockResolvedValueOnce(createFetchResponse({ id: 'photo-1' }))
      .mockResolvedValueOnce(createFetchResponse({ id: 'photo-2' }))
      .mockResolvedValueOnce(createFetchResponse({ error: { message: 'Post creation error' } }));

    await expect(
      publishMultiPhotoPost(['https://a.com/1.jpg', 'https://a.com/2.jpg'], 'caption'),
    ).rejects.toThrow('Facebook multi-photo publish error: Post creation error');
  });

  it('should throw when post creation returns no ID', async () => {
    fetchMock
      .mockResolvedValueOnce(createFetchResponse({ id: 'photo-1' }))
      .mockResolvedValueOnce(createFetchResponse({ id: 'photo-2' }))
      .mockResolvedValueOnce(createFetchResponse({}));

    await expect(
      publishMultiPhotoPost(['https://a.com/1.jpg', 'https://a.com/2.jpg'], 'caption'),
    ).rejects.toThrow('Facebook multi-photo publish failed: no post ID returned');
  });
});

// ---------------------------------------------------------------------------
// Retry behavior (fbFetch)
// ---------------------------------------------------------------------------
describe('fbFetch retry behavior', () => {
  it('should retry on network failure and succeed', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(createFetchResponse({ id: '123_456' }));

    const result = await publishTextPost('retry test');
    expect(result.fbPostId).toBe('123_456');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries on network failure', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('net1'))
      .mockRejectedValueOnce(new Error('net2'))
      .mockRejectedValueOnce(new Error('net3'));

    try {
      await publishTextPost('fail');
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('net3');
    }
  });

  it('should handle 429 rate limit and retry', async () => {
    fetchMock
      .mockResolvedValueOnce(createFetchResponse({}, 429))
      .mockResolvedValueOnce(createFetchResponse({ id: '123_456' }));

    const result = await publishTextPost('rate limited');
    expect(result.fbPostId).toBe('123_456');
  });

  it('should throw FacebookError after max retries on 429', async () => {
    fetchMock
      .mockResolvedValueOnce(createFetchResponse({}, 429))
      .mockResolvedValueOnce(createFetchResponse({}, 429))
      .mockResolvedValueOnce(createFetchResponse({}, 429));

    try {
      await publishTextPost('fail');
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(FacebookError);
      expect((error as FacebookError).message).toContain('rate limit exceeded');
    }
  }, 30000);

  it('should handle API error in response body (not transport error)', async () => {
    fetchMock.mockResolvedValueOnce(
      createFetchResponse({ error: { message: 'Token expired' } }),
    );

    await expect(publishTextPost('test')).rejects.toThrow('Facebook publish error: Token expired');
  });
});
