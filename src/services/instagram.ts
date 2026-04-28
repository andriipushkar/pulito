import { env } from '@/config/env';
import { assertInstagramQuotaAvailable, consumeInstagramQuota } from './instagram-quota';

export class InstagramError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'InstagramError';
  }
}

const GRAPH_API = 'https://graph.facebook.com/v21.0';

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);

      // Handle rate limiting (429)
      if (res.status === 429) {
        const retryAfter =
          Number(res.headers.get('retry-after')) || (baseDelay * Math.pow(2, attempt)) / 1000;
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        throw new InstagramError('Instagram API rate limit exceeded', 429);
      }

      return res;
    } catch (error) {
      lastError = error;
      if (error instanceof InstagramError) throw error;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

interface PublishResult {
  igMediaId: string;
  igPermalink: string;
}

interface AccountInsights {
  impressions: number;
  reach: number;
  profileViews: number;
  followerCount: number;
}

export async function getAccountInsights(): Promise<AccountInsights> {
  const accountId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const accessToken = env.INSTAGRAM_ACCESS_TOKEN;

  if (!accountId || !accessToken) {
    throw new InstagramError('Instagram credentials not configured');
  }

  const res = await fetchWithRetry(
    `${GRAPH_API}/${accountId}/insights?metric=impressions,reach,profile_views&period=day&access_token=${accessToken}`,
    { method: 'GET' },
  );

  const data = await res.json();
  if (data.error) {
    throw new InstagramError(`Failed to get account insights: ${data.error.message}`);
  }

  const metrics = data.data || [];
  const getValue = (name: string) => {
    const metric = metrics.find((m: { name: string }) => m.name === name);
    return metric?.values?.[0]?.value || 0;
  };

  // Get follower count separately
  const profileRes = await fetchWithRetry(
    `${GRAPH_API}/${accountId}?fields=followers_count&access_token=${accessToken}`,
    { method: 'GET' },
  );
  const profileData = await profileRes.json();

  return {
    impressions: getValue('impressions'),
    reach: getValue('reach'),
    profileViews: getValue('profile_views'),
    followerCount: profileData.followers_count || 0,
  };
}

export async function publishImagePost(imageUrl: string, caption: string): Promise<PublishResult> {
  const accountId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const accessToken = env.INSTAGRAM_ACCESS_TOKEN;

  if (!accountId || !accessToken) {
    throw new InstagramError('Instagram credentials not configured');
  }

  await assertInstagramQuotaAvailable();

  // Step 1: Create media container
  const containerRes = await fetchWithRetry(`${GRAPH_API}/${accountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    }),
  });

  const containerData = await containerRes.json();
  if (!containerData.id) {
    throw new InstagramError(
      `Failed to create media container: ${containerData.error?.message || 'Unknown error'}`,
    );
  }

  const creationId = containerData.id;

  // Step 2: Publish the container
  const publishRes = await fetchWithRetry(`${GRAPH_API}/${accountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: accessToken,
    }),
  });

  const publishData = await publishRes.json();
  if (!publishData.id) {
    throw new InstagramError(
      `Failed to publish media: ${publishData.error?.message || 'Unknown error'}`,
    );
  }

  const mediaId = publishData.id;

  // Step 3: Get permalink
  const mediaRes = await fetchWithRetry(
    `${GRAPH_API}/${mediaId}?fields=permalink&access_token=${accessToken}`,
    { method: 'GET' },
  );
  const mediaData = await mediaRes.json();

  await consumeInstagramQuota();

  return {
    igMediaId: mediaId,
    igPermalink: mediaData.permalink || '',
  };
}

export async function publishCarouselPost(
  imageUrls: string[],
  caption: string,
): Promise<PublishResult> {
  const accountId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const accessToken = env.INSTAGRAM_ACCESS_TOKEN;

  if (!accountId || !accessToken) {
    throw new InstagramError('Instagram credentials not configured');
  }

  if (imageUrls.length < 2 || imageUrls.length > 10) {
    throw new InstagramError('Carousel requires 2-10 images');
  }

  await assertInstagramQuotaAvailable();

  // Step 1: Create individual item containers
  const itemIds: string[] = [];
  for (const url of imageUrls) {
    const res = await fetchWithRetry(`${GRAPH_API}/${accountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: url,
        is_carousel_item: true,
        access_token: accessToken,
      }),
    });

    const data = await res.json();
    if (!data.id) {
      throw new InstagramError(
        `Failed to create carousel item: ${data.error?.message || 'Unknown error'}`,
      );
    }
    itemIds.push(data.id);
  }

  // Step 2: Create carousel container
  const containerRes = await fetchWithRetry(`${GRAPH_API}/${accountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: itemIds,
      caption,
      access_token: accessToken,
    }),
  });

  const containerData = await containerRes.json();
  if (!containerData.id) {
    throw new InstagramError(
      `Failed to create carousel container: ${containerData.error?.message || 'Unknown error'}`,
    );
  }

  // Step 3: Publish carousel
  const publishRes = await fetchWithRetry(`${GRAPH_API}/${accountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerData.id,
      access_token: accessToken,
    }),
  });

  const publishData = await publishRes.json();
  if (!publishData.id) {
    throw new InstagramError(
      `Failed to publish carousel: ${publishData.error?.message || 'Unknown error'}`,
    );
  }

  const mediaId = publishData.id;

  // Step 4: Get permalink
  const mediaRes = await fetchWithRetry(
    `${GRAPH_API}/${mediaId}?fields=permalink&access_token=${accessToken}`,
    { method: 'GET' },
  );
  const mediaData = await mediaRes.json();

  await consumeInstagramQuota();

  return {
    igMediaId: mediaId,
    igPermalink: mediaData.permalink || '',
  };
}

export async function publishReelsPost(
  videoUrl: string,
  caption: string,
  coverUrl?: string,
): Promise<PublishResult> {
  const accountId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const accessToken = env.INSTAGRAM_ACCESS_TOKEN;

  if (!accountId || !accessToken) {
    throw new InstagramError('Instagram credentials not configured');
  }

  await assertInstagramQuotaAvailable();

  // Step 1: Create REELS media container
  const containerBody: Record<string, unknown> = {
    media_type: 'REELS',
    video_url: videoUrl,
    caption,
    access_token: accessToken,
  };
  if (coverUrl) {
    containerBody.cover_url = coverUrl;
  }

  const containerRes = await fetchWithRetry(`${GRAPH_API}/${accountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(containerBody),
  });

  const containerData = await containerRes.json();
  if (!containerData.id) {
    throw new InstagramError(
      `Failed to create Reels container: ${containerData.error?.message || 'Unknown error'}`,
    );
  }

  const creationId = containerData.id;

  // Step 2: Wait for video processing (poll status)
  let attempts = 0;
  const maxAttempts = 30;
  while (attempts < maxAttempts) {
    const statusRes = await fetchWithRetry(
      `${GRAPH_API}/${creationId}?fields=status_code&access_token=${accessToken}`,
      { method: 'GET' },
    );
    const statusData = await statusRes.json();

    if (statusData.status_code === 'FINISHED') break;
    if (statusData.status_code === 'ERROR') {
      throw new InstagramError('Video processing failed');
    }

    attempts++;
    await new Promise((r) => setTimeout(r, 5000)); // Wait 5 seconds between polls
  }

  if (attempts >= maxAttempts) {
    throw new InstagramError('Video processing timed out');
  }

  // Step 3: Publish the container
  const publishRes = await fetchWithRetry(`${GRAPH_API}/${accountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: accessToken,
    }),
  });

  const publishData = await publishRes.json();
  if (!publishData.id) {
    throw new InstagramError(
      `Failed to publish Reels: ${publishData.error?.message || 'Unknown error'}`,
    );
  }

  const mediaId = publishData.id;

  // Step 4: Get permalink
  const mediaRes = await fetchWithRetry(
    `${GRAPH_API}/${mediaId}?fields=permalink&access_token=${accessToken}`,
    { method: 'GET' },
  );
  const mediaData = await mediaRes.json();

  await consumeInstagramQuota();

  return {
    igMediaId: mediaId,
    igPermalink: mediaData.permalink || '',
  };
}

export async function postFirstComment(mediaId: string, comment: string): Promise<string> {
  const accessToken = env.INSTAGRAM_ACCESS_TOKEN;

  if (!accessToken) {
    throw new InstagramError('Instagram access token not configured');
  }

  const res = await fetchWithRetry(`${GRAPH_API}/${mediaId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: comment,
      access_token: accessToken,
    }),
  });

  const data = await res.json();
  if (!data.id) {
    throw new InstagramError(`Failed to post comment: ${data.error?.message || 'Unknown error'}`);
  }

  return data.id;
}

export async function getMediaInsights(mediaId: string) {
  const accessToken = env.INSTAGRAM_ACCESS_TOKEN;

  if (!accessToken) {
    throw new InstagramError('Instagram access token not configured');
  }

  const res = await fetch(
    `${GRAPH_API}/${mediaId}/insights?metric=impressions,reach,engagement,saved&access_token=${accessToken}`,
  );

  const data = await res.json();
  if (data.error) {
    throw new InstagramError(`Failed to get insights: ${data.error.message}`);
  }

  return data.data;
}
