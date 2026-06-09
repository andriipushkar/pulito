import { prisma } from '@/lib/prisma';

export class PublicationTemplateError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'PublicationTemplateError';
  }
}

export interface ChannelContentBlock {
  title?: string;
  content?: string;
  hashtags?: string;
}

export interface TemplateInput {
  name: string;
  description?: string | null;
  channels: string[];
  titleTemplate?: string | null;
  contentTemplate: string;
  hashtagsTemplate?: string | null;
  channelContents?: Record<string, ChannelContentBlock> | null;
  buttons?: unknown;
  firstComment?: string | null;
  isActive?: boolean;
}

const ALLOWED_CHANNELS = new Set(['telegram', 'instagram', 'facebook', 'tiktok', 'site']);

function validateChannels(channels: unknown): string[] {
  if (!Array.isArray(channels) || channels.length === 0) {
    throw new PublicationTemplateError('Шаблон має містити хоча б один канал', 400);
  }
  const normalized = channels.map((c) => String(c).toLowerCase().trim());
  for (const c of normalized) {
    if (!ALLOWED_CHANNELS.has(c)) {
      throw new PublicationTemplateError(`Невідомий канал: ${c}`, 400);
    }
  }
  return Array.from(new Set(normalized));
}

export async function listTemplates(activeOnly = false) {
  return prisma.publicationTemplate.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { name: 'asc' },
  });
}

export async function getTemplate(id: number) {
  const t = await prisma.publicationTemplate.findUnique({ where: { id } });
  if (!t) throw new PublicationTemplateError('Шаблон не знайдено', 404);
  return t;
}

export async function createTemplate(input: TemplateInput, createdBy: number | null = null) {
  if (!input.name || input.name.trim().length < 2) {
    throw new PublicationTemplateError('Назва шаблону обов’язкова (мін. 2 символи)', 400);
  }
  if (!input.contentTemplate || input.contentTemplate.trim().length === 0) {
    throw new PublicationTemplateError('Зміст шаблону обов’язковий', 400);
  }
  const channels = validateChannels(input.channels);

  const existing = await prisma.publicationTemplate.findUnique({
    where: { name: input.name.trim() },
  });
  if (existing) {
    throw new PublicationTemplateError('Шаблон з такою назвою вже існує', 409);
  }

  return prisma.publicationTemplate.create({
    data: {
      name: input.name.trim(),
      description: input.description ?? null,
      channels,
      titleTemplate: input.titleTemplate ?? null,
      contentTemplate: input.contentTemplate,
      hashtagsTemplate: input.hashtagsTemplate ?? null,
      channelContents: (input.channelContents ?? null) as never,
      buttons: (input.buttons ?? null) as never,
      firstComment: input.firstComment ?? null,
      isActive: input.isActive ?? true,
      createdBy,
    },
  });
}

export async function updateTemplate(id: number, input: Partial<TemplateInput>) {
  await getTemplate(id);

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    if (!input.name.trim()) {
      throw new PublicationTemplateError('Назва не може бути порожньою', 400);
    }
    data.name = input.name.trim();
  }
  if (input.description !== undefined) data.description = input.description;
  if (input.channels !== undefined) data.channels = validateChannels(input.channels);
  if (input.titleTemplate !== undefined) data.titleTemplate = input.titleTemplate;
  if (input.contentTemplate !== undefined) {
    if (!input.contentTemplate.trim()) {
      throw new PublicationTemplateError('Зміст не може бути порожнім', 400);
    }
    data.contentTemplate = input.contentTemplate;
  }
  if (input.hashtagsTemplate !== undefined) data.hashtagsTemplate = input.hashtagsTemplate;
  if (input.channelContents !== undefined) data.channelContents = input.channelContents;
  if (input.buttons !== undefined) data.buttons = input.buttons;
  if (input.firstComment !== undefined) data.firstComment = input.firstComment;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  return prisma.publicationTemplate.update({ where: { id }, data });
}

export async function deleteTemplate(id: number) {
  await getTemplate(id);
  await prisma.publicationTemplate.delete({ where: { id } });
}

/**
 * Render a template's text fields, replacing product placeholders with concrete values.
 * Returns content ready to seed a new Publication form (does NOT create a Publication).
 *
 * Supported placeholders mirror those in publication.ts: {{product.name}}, {{product.price}},
 * {{product.oldPrice}}, {{product.code}}, {{product.url}}, {{product.discount}}.
 */
export async function applyTemplate(
  templateId: number,
  productId: number | null = null,
): Promise<{
  title: string;
  content: string;
  hashtags: string | null;
  channels: string[];
  channelContents: Record<string, ChannelContentBlock> | null;
  buttons: unknown;
  firstComment: string | null;
}> {
  const tpl = await getTemplate(templateId);

  let appUrl = process.env.APP_URL || 'http://localhost:3000';
  appUrl = appUrl.replace(/\/$/, '');

  const product = productId
    ? await prisma.product.findUnique({
        where: { id: productId },
        select: {
          name: true,
          priceRetail: true,
          priceRetailOld: true,
          code: true,
          slug: true,
        },
      })
    : null;

  const subst = (text: string | null | undefined): string => {
    if (!text) return '';
    if (!product) return text;
    const discount = product.priceRetailOld
      ? Math.round((1 - Number(product.priceRetail) / Number(product.priceRetailOld)) * 100)
      : 0;
    return text
      .replace(/\{\{product\.name\}\}/g, product.name)
      .replace(/\{\{product\.price\}\}/g, `${Number(product.priceRetail).toFixed(2)} грн`)
      .replace(
        /\{\{product\.oldPrice\}\}/g,
        product.priceRetailOld ? `${Number(product.priceRetailOld).toFixed(2)} грн` : '',
      )
      .replace(/\{\{product\.code\}\}/g, product.code)
      .replace(/\{\{product\.url\}\}/g, `${appUrl}/product/${product.slug}`)
      .replace(/\{\{product\.discount\}\}/g, `${discount}%`);
  };

  const rawCC =
    (tpl.channelContents as Record<string, ChannelContentBlock> | null | undefined) ?? null;
  const channelContents: Record<string, ChannelContentBlock> | null = rawCC
    ? Object.fromEntries(
        Object.entries(rawCC).map(([ch, cc]) => [
          ch,
          {
            title: cc.title ? subst(cc.title) : undefined,
            content: cc.content ? subst(cc.content) : undefined,
            hashtags: cc.hashtags ? subst(cc.hashtags) : undefined,
          },
        ]),
      )
    : null;

  return {
    title: subst(tpl.titleTemplate) || tpl.name,
    content: subst(tpl.contentTemplate),
    hashtags: tpl.hashtagsTemplate ? subst(tpl.hashtagsTemplate) : null,
    channels: tpl.channels as string[],
    channelContents,
    buttons: tpl.buttons,
    firstComment: tpl.firstComment ? subst(tpl.firstComment) : null,
  };
}
