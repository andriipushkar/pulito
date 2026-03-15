import { prisma } from '@/lib/prisma';
import { Prisma } from '@/../generated/prisma';
import { publishImagePost, publishReelsPost, postFirstComment } from '@/services/instagram';
import { publishTextPost, publishPhotoPost } from '@/services/facebook';
import { getChannelConfig } from '@/services/channel-config';

export class PublicationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'PublicationError';
  }
}

interface ChannelContent {
  title?: string;
  content?: string;
  hashtags?: string;
}

interface CreatePublicationInput {
  title: string;
  content: string;
  imagePath?: string;
  productId?: number;
  channels: string[]; // ['telegram', 'viber', 'facebook', 'instagram', 'site']
  hashtags?: string;
  buttons?: { text: string; url: string }[];
  scheduledAt?: string;
  channelContents?: Record<string, ChannelContent>;
  additionalImages?: string[];
  applyWatermark?: boolean;
}

export async function createPublication(input: CreatePublicationInput, userId: number) {
  const status = input.scheduledAt ? 'scheduled' : 'draft';

  // Apply watermark if requested
  let imagePath = input.imagePath;
  if (input.applyWatermark && imagePath) {
    try {
      const { applyWatermark: addWatermark } = await import('@/services/watermark');
      imagePath = await addWatermark(imagePath);
    } catch (err) {
      console.error('Watermark failed, using original:', err);
    }
  }

  const pub = await prisma.publication.create({
    data: {
      title: input.title,
      content: input.content,
      imagePath,
      productId: input.productId,
      channels: input.channels,
      hashtags: input.hashtags,
      buttons: input.buttons,
      channelContents: input.channelContents ? (input.channelContents as unknown as Prisma.InputJsonValue) : undefined,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      status: status as 'draft' | 'scheduled',
      createdBy: userId,
    },
  });

  // Save additional images for carousel
  if (input.additionalImages && input.additionalImages.length > 0) {
    await prisma.publicationImage.createMany({
      data: input.additionalImages.map((path, i) => ({
        publicationId: pub.id,
        imagePath: path,
        sortOrder: i + 1,
      })),
    });
  }

  return pub;
}

export async function getPublications(params: { page?: number; limit?: number; status?: string } = {}) {
  const { page = 1, limit = 20, status } = params;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [publications, total] = await Promise.all([
    prisma.publication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        creator: { select: { fullName: true } },
        product: { select: { name: true, slug: true } },
        channelResults: { orderBy: { channel: 'asc' } },
      },
    }),
    prisma.publication.count({ where }),
  ]);

  return { publications, total };
}

export async function updatePublication(
  id: number,
  data: Partial<Omit<CreatePublicationInput, 'channels'>> & { channels?: string[]; status?: string; channelContents?: Record<string, ChannelContent> | null }
) {
  const pub = await prisma.publication.findUnique({ where: { id } });
  if (!pub) throw new PublicationError('Публікацію не знайдено', 404);

  const validStatuses = ['draft', 'scheduled', 'published', 'failed'] as const;
  const status = data.status && validStatuses.includes(data.status as typeof validStatuses[number])
    ? (data.status as typeof validStatuses[number])
    : undefined;

  return prisma.publication.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.imagePath !== undefined && { imagePath: data.imagePath }),
      ...(data.channels !== undefined && { channels: data.channels }),
      ...(data.hashtags !== undefined && { hashtags: data.hashtags }),
      ...(data.channelContents !== undefined && { channelContents: (data.channelContents as unknown as Prisma.InputJsonValue) ?? null }),
      ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null }),
      ...(status !== undefined && { status }),
    },
  });
}

export async function deletePublication(id: number) {
  const pub = await prisma.publication.findUnique({ where: { id } });
  if (!pub) throw new PublicationError('Публікацію не знайдено', 404);
  if (pub.status === 'published') throw new PublicationError('Не можна видалити опубліковану публікацію', 400);

  await prisma.publication.delete({ where: { id } });
}

// Resolve template variables like {{product.name}} in text
async function resolveTemplateVars(text: string, productId: number | null, appUrl: string): Promise<string> {
  if (!productId || !text.includes('{{')) return text;
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, priceRetail: true, priceRetailOld: true, code: true, slug: true },
  });
  if (!product) return text;
  const discount = product.priceRetailOld
    ? Math.round((1 - Number(product.priceRetail) / Number(product.priceRetailOld)) * 100)
    : 0;
  return text
    .replace(/\{\{product\.name\}\}/g, product.name)
    .replace(/\{\{product\.price\}\}/g, `${product.priceRetail} грн`)
    .replace(/\{\{product\.oldPrice\}\}/g, product.priceRetailOld ? `${product.priceRetailOld} грн` : '')
    .replace(/\{\{product\.code\}\}/g, product.code)
    .replace(/\{\{product\.url\}\}/g, `${appUrl}/product/${product.slug}`)
    .replace(/\{\{product\.discount\}\}/g, `${discount}%`);
}

// Get channel-specific content, falling back to defaults
function getContentForChannel(
  pub: { title: string; content: string; hashtags: string | null; channelContents: unknown },
  channel: string,
): { title: string; content: string; hashtags: string | null } {
  const overrides = pub.channelContents as Record<string, ChannelContent> | null;
  if (overrides && overrides[channel]) {
    const cc = overrides[channel];
    return {
      title: cc.title || pub.title,
      content: cc.content || pub.content,
      hashtags: cc.hashtags !== undefined ? (cc.hashtags || null) : pub.hashtags,
    };
  }
  return { title: pub.title, content: pub.content, hashtags: pub.hashtags };
}

// Publish a single channel and record result
async function publishToChannel(
  pub: { id: number; title: string; content: string; imagePath: string | null; hashtags: string | null; buttons: unknown; firstComment: string | null; productId: number | null; channelContents: unknown },
  channel: string,
  appUrl: string,
): Promise<{ status: 'published' | 'failed'; externalId?: string; permalink?: string; error?: string }> {
  const rawCC = getContentForChannel(pub, channel);
  const cc = {
    title: await resolveTemplateVars(rawCC.title, pub.productId, appUrl),
    content: await resolveTemplateVars(rawCC.content, pub.productId, appUrl),
    hashtags: rawCC.hashtags ? await resolveTemplateVars(rawCC.hashtags, pub.productId, appUrl) : null,
  };
  switch (channel) {
    case 'telegram': {
      const tgConfig = await getChannelConfig('telegram');
      if (!tgConfig?.botToken || !tgConfig?.channelId) return { status: 'failed', error: 'Канал не налаштовано' };
      const tgText = `<b>${cc.title}</b>\n\n${cc.content}${cc.hashtags ? `\n\n${cc.hashtags}` : ''}`;
      const replyMarkup = pub.buttons
        ? { inline_keyboard: (pub.buttons as { text: string; url: string }[]).map((b) => [{ text: b.text, url: b.url }]) }
        : undefined;
      const endpoint = pub.imagePath ? 'sendPhoto' : 'sendMessage';
      const body = pub.imagePath
        ? { chat_id: tgConfig.channelId, photo: `${appUrl}${pub.imagePath}`, caption: tgText, parse_mode: 'HTML', reply_markup: replyMarkup }
        : { chat_id: tgConfig.channelId, text: tgText, parse_mode: 'HTML', reply_markup: replyMarkup };
      const res = await fetch(`https://api.telegram.org/bot${tgConfig.botToken}/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) return { status: 'failed', error: data.description || 'Telegram API error' };
      const msgId = String(data.result?.message_id || '');
      await prisma.publication.update({ where: { id: pub.id }, data: { tgMessageId: BigInt(data.result.message_id) } });
      return { status: 'published', externalId: msgId };
    }
    case 'viber': {
      const viberConfig = await getChannelConfig('viber');
      if (!viberConfig?.authToken) return { status: 'failed', error: 'Канал не налаштовано' };
      const viberText = `${cc.title}\n\n${cc.content}${cc.hashtags ? `\n\n${cc.hashtags}` : ''}`;
      const viberBody = pub.imagePath
        ? { type: 'picture', text: viberText, media: `${appUrl}${pub.imagePath}`, min_api_version: 7 }
        : { type: 'text', text: viberText, min_api_version: 7 };
      const res = await fetch('https://chatapi.viber.com/pa/broadcast_message', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Viber-Auth-Token': viberConfig.authToken },
        body: JSON.stringify(viberBody),
      });
      const data = await res.json();
      if (data.message_token) {
        await prisma.publication.update({ where: { id: pub.id }, data: { viberMsgToken: String(data.message_token) } });
        return { status: 'published', externalId: String(data.message_token) };
      }
      return { status: 'failed', error: data.status_message || 'Viber API error' };
    }
    case 'instagram': {
      const igConfig = await getChannelConfig('instagram');
      if (!igConfig?.accessToken || !igConfig?.businessAccountId) return { status: 'failed', error: 'Канал не налаштовано' };
      const caption = `${cc.title}\n\n${cc.content}${cc.hashtags ? `\n\n${cc.hashtags}` : ''}`;
      const imageUrl = pub.imagePath ? `${appUrl}${pub.imagePath}` : '';
      let result: { igMediaId: string; igPermalink: string } | null = null;
      const images = await prisma.publicationImage.findMany({ where: { publicationId: pub.id }, orderBy: { sortOrder: 'asc' } });
      const videoImage = images.find((img) => img.imagePath.endsWith('.mp4') || img.imagePath.endsWith('.mov'));
      if (videoImage) {
        const coverImage = images.find((img) => !img.imagePath.endsWith('.mp4') && !img.imagePath.endsWith('.mov'));
        result = await publishReelsPost(`${appUrl}${videoImage.imagePath}`, caption, coverImage ? `${appUrl}${coverImage.imagePath}` : undefined);
      } else if (imageUrl) {
        result = await publishImagePost(imageUrl, caption);
      }
      if (!result) return { status: 'failed', error: 'Немає зображення для Instagram' };
      await prisma.publication.update({ where: { id: pub.id }, data: { igMediaId: result.igMediaId, igPermalink: result.igPermalink } });
      if (pub.firstComment) {
        try { await postFirstComment(result.igMediaId, pub.firstComment); } catch { /* ignore */ }
      }
      return { status: 'published', externalId: result.igMediaId, permalink: result.igPermalink };
    }
    case 'facebook': {
      const fbConfig = await getChannelConfig('facebook');
      if (!fbConfig?.pageAccessToken || !fbConfig?.pageId) return { status: 'failed', error: 'Канал не налаштовано' };
      const caption = `${cc.title}\n\n${cc.content}${cc.hashtags ? `\n\n${cc.hashtags}` : ''}`;
      const imageUrl = pub.imagePath ? `${appUrl}${pub.imagePath}` : '';
      let result: { fbPostId: string; fbPermalink: string } | null = null;
      if (imageUrl) {
        result = await publishPhotoPost(imageUrl, caption);
      } else {
        const productLink = pub.productId
          ? `${appUrl}/product/${(await prisma.product.findUnique({ where: { id: pub.productId }, select: { slug: true } }))?.slug || ''}`
          : undefined;
        result = await publishTextPost(caption, productLink);
      }
      if (!result) return { status: 'failed', error: 'Facebook API error' };
      await prisma.publication.update({ where: { id: pub.id }, data: { fbPostId: result.fbPostId, fbPermalink: result.fbPermalink } });
      return { status: 'published', externalId: result.fbPostId, permalink: result.fbPermalink };
    }
    case 'tiktok': {
      const ttConfig = await getChannelConfig('tiktok');
      if (!ttConfig?.accessToken) return { status: 'failed', error: 'Канал не налаштовано' };
      // TikTok Content Posting API — placeholder until full integration
      return { status: 'failed', error: 'TikTok публікація потребує завантаження відео (скоро)' };
    }
    case 'site':
      // Site publication is just the publication record itself
      return { status: 'published' };
    case 'olx':
    case 'rozetka':
    case 'prom':
    case 'epicentrk': {
      // Marketplace channels — publish product listing
      const { publishToMarketplace } = await import('@/services/marketplaces');
      const product = pub.productId
        ? await prisma.product.findUnique({
            where: { id: pub.productId },
            select: { id: true, name: true, code: true, priceRetail: true, quantity: true, imagePath: true, images: { select: { pathFull: true }, take: 8 } },
          })
        : null;
      const images = product?.images.map((img) => img.pathFull).filter(Boolean) as string[] || [];
      if (pub.imagePath && !images.includes(pub.imagePath)) images.unshift(pub.imagePath);
      return publishToMarketplace(channel, {
        title: cc.title,
        description: `${cc.content}${cc.hashtags ? `\n\n${cc.hashtags}` : ''}`,
        price: product ? Number(product.priceRetail) : 0,
        images,
        productCode: product?.code,
        quantity: product?.quantity ?? 1,
      }, appUrl);
    }
    default:
      return { status: 'failed', error: `Невідомий канал: ${channel}` };
  }
}

export async function publishNow(publicationId: number, targetChannels?: string[]) {
  const pub = await prisma.publication.findUnique({ where: { id: publicationId } });
  if (!pub) throw new PublicationError('Публікацію не знайдено', 404);

  const channels = targetChannels || (pub.channels as string[]);
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  for (const channel of channels) {
    // Upsert channel record as pending
    await prisma.publicationChannel.upsert({
      where: { publicationId_channel: { publicationId, channel } },
      create: { publicationId, channel, status: 'pending' },
      update: { status: 'pending', errorMessage: null },
    });

    try {
      const result = await publishToChannel(
        { id: pub.id, title: pub.title, content: pub.content, imagePath: pub.imagePath, hashtags: pub.hashtags, buttons: pub.buttons, firstComment: pub.firstComment, productId: pub.productId, channelContents: pub.channelContents },
        channel,
        appUrl,
      );

      await prisma.publicationChannel.update({
        where: { publicationId_channel: { publicationId, channel } },
        data: {
          status: result.status,
          externalId: result.externalId || null,
          permalink: result.permalink || null,
          errorMessage: result.error || null,
          publishedAt: result.status === 'published' ? new Date() : null,
          retryCount: { increment: 1 },
        },
      });
    } catch (err) {
      console.error(`${channel} publish error:`, err);
      await prisma.publicationChannel.update({
        where: { publicationId_channel: { publicationId, channel } },
        data: {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : 'Невідома помилка',
          retryCount: { increment: 1 },
        },
      });
    }
  }

  // Determine overall status
  const allResults = await prisma.publicationChannel.findMany({ where: { publicationId } });
  const allPublished = allResults.every((r) => r.status === 'published');
  const anyPublished = allResults.some((r) => r.status === 'published');
  const overallStatus = allPublished ? 'published' : anyPublished ? 'published' : 'failed';

  return prisma.publication.update({
    where: { id: publicationId },
    data: {
      status: overallStatus as 'published' | 'failed',
      publishedAt: anyPublished ? new Date() : null,
    },
    include: { channelResults: true },
  });
}

// Retry a single failed channel
export async function retryChannel(publicationId: number, channel: string) {
  return publishNow(publicationId, [channel]);
}

// Sync analytics data from external APIs
export async function syncPublicationAnalytics(publicationId: number) {
  const channels = await prisma.publicationChannel.findMany({
    where: { publicationId, status: 'published' },
  });
  const pub = await prisma.publication.findUnique({ where: { id: publicationId } });
  if (!pub) throw new PublicationError('Публікацію не знайдено', 404);

  for (const ch of channels) {
    try {
      let views: number | null = null;
      let clicks: number | null = null;
      let engagement: number | null = null;

      if (ch.channel === 'telegram' && pub.tgMessageId) {
        const config = await getChannelConfig('telegram');
        if (config?.botToken && config?.channelId) {
          // Telegram doesn't have a direct views API for channels, but forwarded messages have view_count
          // For now, we track what's available
          views = null;
        }
      } else if (ch.channel === 'instagram' && pub.igMediaId) {
        const config = await getChannelConfig('instagram');
        if (config?.accessToken) {
          const res = await fetch(
            `https://graph.facebook.com/v21.0/${pub.igMediaId}/insights?metric=impressions,reach,engagement&access_token=${config.accessToken}`
          );
          const data = await res.json();
          if (data.data) {
            for (const metric of data.data) {
              if (metric.name === 'impressions') views = metric.values?.[0]?.value || 0;
              if (metric.name === 'engagement') clicks = metric.values?.[0]?.value || 0;
              if (metric.name === 'reach' && views) {
                engagement = views > 0 ? ((clicks || 0) / views) * 100 : 0;
              }
            }
          }
        }
      } else if (ch.channel === 'facebook' && pub.fbPostId) {
        const config = await getChannelConfig('facebook');
        if (config?.pageAccessToken) {
          const res = await fetch(
            `https://graph.facebook.com/v21.0/${pub.fbPostId}/insights?metric=post_impressions,post_clicks,post_engaged_users&access_token=${config.pageAccessToken}`
          );
          const data = await res.json();
          if (data.data) {
            for (const metric of data.data) {
              if (metric.name === 'post_impressions') views = metric.values?.[0]?.value || 0;
              if (metric.name === 'post_clicks') clicks = metric.values?.[0]?.value || 0;
              if (metric.name === 'post_engaged_users' && views) {
                engagement = views > 0 ? ((metric.values?.[0]?.value || 0) / views) * 100 : 0;
              }
            }
          }
        }
      }

      if (views !== null || clicks !== null || engagement !== null) {
        await prisma.publicationChannel.update({
          where: { id: ch.id },
          data: { views, clicks, engagement },
        });
      }
    } catch (err) {
      console.error(`Analytics sync error for ${ch.channel}:`, err);
    }
  }

  return prisma.publicationChannel.findMany({ where: { publicationId } });
}
