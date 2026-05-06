import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    publicationTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  PublicationTemplateError,
  applyTemplate,
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from './publication-template';

const tplFind = vi.mocked(prisma.publicationTemplate.findMany);
const tplFindOne = vi.mocked(prisma.publicationTemplate.findUnique);
const tplCreate = vi.mocked(prisma.publicationTemplate.create);
const tplUpdate = vi.mocked(prisma.publicationTemplate.update);
const tplDelete = vi.mocked(prisma.publicationTemplate.delete);
const productFind = vi.mocked(prisma.product.findUnique);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listTemplates', () => {
  it('returns all templates by default', async () => {
    tplFind.mockResolvedValue([] as never);
    await listTemplates();
    expect(tplFind).toHaveBeenCalledWith({ where: undefined, orderBy: { name: 'asc' } });
  });

  it('filters to active when activeOnly=true', async () => {
    tplFind.mockResolvedValue([] as never);
    await listTemplates(true);
    expect(tplFind).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  });
});

describe('getTemplate', () => {
  it('throws 404 when not found', async () => {
    tplFindOne.mockResolvedValue(null);
    await expect(getTemplate(99)).rejects.toThrow(PublicationTemplateError);
  });
});

describe('createTemplate', () => {
  it('rejects empty name', async () => {
    await expect(
      createTemplate({ name: '', channels: ['telegram'], contentTemplate: 'x' }),
    ).rejects.toThrow();
  });

  it('rejects empty content', async () => {
    await expect(
      createTemplate({ name: 'Test', channels: ['telegram'], contentTemplate: '' }),
    ).rejects.toThrow();
  });

  it('rejects unknown channel', async () => {
    await expect(
      createTemplate({ name: 'Test', channels: ['nope'], contentTemplate: 'x' }),
    ).rejects.toThrow(/Невідомий канал/);
  });

  it('rejects empty channels array', async () => {
    await expect(
      createTemplate({ name: 'Test', channels: [], contentTemplate: 'x' }),
    ).rejects.toThrow(/хоча б один канал/);
  });

  it('rejects duplicate name', async () => {
    tplFindOne.mockResolvedValue({ id: 1, name: 'Test' } as never);
    await expect(
      createTemplate({ name: 'Test', channels: ['telegram'], contentTemplate: 'x' }),
    ).rejects.toThrow(/вже існує/);
  });

  it('creates with normalised channels and trimmed name', async () => {
    tplFindOne.mockResolvedValue(null);
    tplCreate.mockResolvedValue({ id: 1 } as never);
    await createTemplate(
      {
        name: '  Promo  ',
        channels: ['Telegram', 'instagram', 'telegram'],
        contentTemplate: 'Hello',
      },
      42,
    );
    const arg = tplCreate.mock.calls[0][0] as unknown as {
      data: { name: string; channels: string[]; createdBy: number };
    };
    expect(arg.data.name).toBe('Promo');
    expect(arg.data.channels).toEqual(['telegram', 'instagram']);
    expect(arg.data.createdBy).toBe(42);
  });
});

describe('updateTemplate', () => {
  it('updates only provided fields', async () => {
    tplFindOne.mockResolvedValue({ id: 1 } as never);
    tplUpdate.mockResolvedValue({ id: 1 } as never);
    await updateTemplate(1, { isActive: false });
    expect(tplUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: false },
    });
  });

  it('rejects empty name', async () => {
    tplFindOne.mockResolvedValue({ id: 1 } as never);
    await expect(updateTemplate(1, { name: '   ' })).rejects.toThrow();
  });
});

describe('deleteTemplate', () => {
  it('throws when missing', async () => {
    tplFindOne.mockResolvedValue(null);
    await expect(deleteTemplate(1)).rejects.toThrow(PublicationTemplateError);
  });

  it('deletes when found', async () => {
    tplFindOne.mockResolvedValue({ id: 1 } as never);
    tplDelete.mockResolvedValue({ id: 1 } as never);
    await deleteTemplate(1);
    expect(tplDelete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});

describe('applyTemplate', () => {
  it('substitutes product placeholders', async () => {
    tplFindOne.mockResolvedValue({
      id: 1,
      name: 'Promo',
      titleTemplate: '{{product.name}} — акція!',
      contentTemplate: '{{product.name}} тільки за {{product.price}}',
      hashtagsTemplate: '#{{product.code}}',
      channels: ['telegram'],
      channelContents: null,
      buttons: null,
      firstComment: null,
    } as never);
    productFind.mockResolvedValue({
      name: 'Whisky',
      priceRetail: '120.50',
      priceRetailOld: '150.00',
      code: 'W001',
      slug: 'whisky',
    } as never);

    const out = await applyTemplate(1, 7);
    expect(out.title).toBe('Whisky — акція!');
    expect(out.content).toBe('Whisky тільки за 120.50 грн');
    expect(out.hashtags).toBe('#W001');
  });

  it('returns raw text when productId is null', async () => {
    tplFindOne.mockResolvedValue({
      id: 1,
      name: 'Generic',
      titleTemplate: 'Hi',
      contentTemplate: 'No placeholders here',
      hashtagsTemplate: null,
      channels: ['site'],
      channelContents: null,
      buttons: null,
      firstComment: null,
    } as never);

    const out = await applyTemplate(1, null);
    expect(out.title).toBe('Hi');
    expect(out.content).toBe('No placeholders here');
    expect(out.hashtags).toBeNull();
    expect(productFind).not.toHaveBeenCalled();
  });

  it('falls back to template name when no titleTemplate', async () => {
    tplFindOne.mockResolvedValue({
      id: 1,
      name: 'NamedFallback',
      titleTemplate: null,
      contentTemplate: 'body',
      hashtagsTemplate: null,
      channels: ['site'],
      channelContents: null,
      buttons: null,
      firstComment: null,
    } as never);
    const out = await applyTemplate(1, null);
    expect(out.title).toBe('NamedFallback');
  });
});
