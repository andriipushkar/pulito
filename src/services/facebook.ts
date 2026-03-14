import { env } from '@/config/env';

export class FacebookError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'FacebookError';
  }
}

const GRAPH_API = 'https://graph.facebook.com/v21.0';

async function fbFetch(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        }
        throw new FacebookError('Facebook API rate limit exceeded', 429);
      }
      return res;
    } catch (error) {
      lastError = error;
      if (error instanceof FacebookError) throw error;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastError;
}

interface FbPublishResult {
  fbPostId: string;
  fbPermalink: string;
}

/** Publish a text post (with optional link) to Facebook Page feed. */
export async function publishTextPost(message: string, link?: string): Promise<FbPublishResult> {
  const pageId = env.FACEBOOK_PAGE_ID;
  const accessToken = env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    throw new FacebookError('Facebook credentials not configured');
  }

  const body: Record<string, string> = { message, access_token: accessToken };
  if (link) body.link = link;

  const res = await fbFetch(`${GRAPH_API}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.error) {
    throw new FacebookError(`Facebook publish error: ${data.error.message}`, data.error.code || 400);
  }
  if (!data.id) {
    throw new FacebookError('Facebook publish failed: no post ID returned');
  }

  const postId = data.id as string;
  const permalink = `https://www.facebook.com/${postId.replace('_', '/posts/')}`;

  return { fbPostId: postId, fbPermalink: permalink };
}

/** Publish a photo post to Facebook Page. */
export async function publishPhotoPost(imageUrl: string, caption: string): Promise<FbPublishResult> {
  const pageId = env.FACEBOOK_PAGE_ID;
  const accessToken = env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    throw new FacebookError('Facebook credentials not configured');
  }

  const res = await fbFetch(`${GRAPH_API}/${pageId}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: imageUrl,
      message: caption,
      access_token: accessToken,
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new FacebookError(`Facebook photo publish error: ${data.error.message}`, data.error.code || 400);
  }
  if (!data.post_id && !data.id) {
    throw new FacebookError('Facebook photo publish failed: no post ID returned');
  }

  const postId = (data.post_id || data.id) as string;
  const permalink = `https://www.facebook.com/${postId.replace('_', '/posts/')}`;

  return { fbPostId: postId, fbPermalink: permalink };
}

/** Publish multiple photos as a single post. */
export async function publishMultiPhotoPost(imageUrls: string[], caption: string): Promise<FbPublishResult> {
  const pageId = env.FACEBOOK_PAGE_ID;
  const accessToken = env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    throw new FacebookError('Facebook credentials not configured');
  }

  if (imageUrls.length === 0) {
    throw new FacebookError('At least one image is required');
  }
  if (imageUrls.length === 1) {
    return publishPhotoPost(imageUrls[0], caption);
  }

  // Step 1: Upload each photo as unpublished
  const photoIds: string[] = [];
  for (const url of imageUrls) {
    const res = await fbFetch(`${GRAPH_API}/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        published: false,
        access_token: accessToken,
      }),
    });
    const data = await res.json();
    if (!data.id) {
      throw new FacebookError(`Failed to upload photo: ${data.error?.message || 'Unknown error'}`);
    }
    photoIds.push(data.id);
  }

  // Step 2: Create post with attached photos
  const attachedMedia = photoIds.map((id) => ({ media_fbid: id }));
  const res = await fbFetch(`${GRAPH_API}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: caption,
      attached_media: attachedMedia,
      access_token: accessToken,
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new FacebookError(`Facebook multi-photo publish error: ${data.error.message}`);
  }
  if (!data.id) {
    throw new FacebookError('Facebook multi-photo publish failed: no post ID returned');
  }

  const postId = data.id as string;
  const permalink = `https://www.facebook.com/${postId.replace('_', '/posts/')}`;

  return { fbPostId: postId, fbPermalink: permalink };
}
