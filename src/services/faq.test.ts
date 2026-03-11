import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    faqItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as MockPrismaClient;

import {
  getPublishedFaq,
  getFaqCategories,
  getAllFaq,
  searchFaq,
  createFaqItem,
  updateFaqItem,
  deleteFaqItem,
  incrementFaqClick,
  FaqError,
} from './faq';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FaqError', () => {
  it('should create a FaqError with status code', () => {
    const error = new FaqError('not found', 404);
    expect(error.message).toBe('not found');
    expect(error.name).toBe('FaqError');
    expect(error.statusCode).toBe(404);
  });

  it('should be an instance of Error', () => {
    const error = new FaqError('test', 400);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('getPublishedFaq', () => {
  it('should return published FAQ items grouped by category', async () => {
    const items = [
      { id: 1, category: 'Доставка', question: 'Q1', answer: 'A1', isPublished: true, sortOrder: 0 },
      { id: 2, category: 'Доставка', question: 'Q2', answer: 'A2', isPublished: true, sortOrder: 1 },
      { id: 3, category: 'Оплата', question: 'Q3', answer: 'A3', isPublished: true, sortOrder: 0 },
    ];
    mockPrisma.faqItem.findMany.mockResolvedValue(items as never);

    const result = await getPublishedFaq();

    expect(mockPrisma.faqItem.findMany).toHaveBeenCalledWith({
      where: { isPublished: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
    expect(result).toEqual({
      'Доставка': [items[0], items[1]],
      'Оплата': [items[2]],
    });
  });

  it('should return empty object when no published items exist', async () => {
    mockPrisma.faqItem.findMany.mockResolvedValue([] as never);

    const result = await getPublishedFaq();

    expect(result).toEqual({});
  });

  it('should handle single category with multiple items', async () => {
    const items = [
      { id: 1, category: 'Загальні', question: 'Q1', answer: 'A1', isPublished: true, sortOrder: 0 },
      { id: 2, category: 'Загальні', question: 'Q2', answer: 'A2', isPublished: true, sortOrder: 1 },
    ];
    mockPrisma.faqItem.findMany.mockResolvedValue(items as never);

    const result = await getPublishedFaq();

    expect(Object.keys(result)).toHaveLength(1);
    expect(result['Загальні']).toHaveLength(2);
  });
});

describe('searchFaq', () => {
  it('should search FAQ items by question and answer', async () => {
    const items = [
      { id: 1, question: 'Як оплатити?', answer: 'Карткою', clickCount: 10 },
    ];
    mockPrisma.faqItem.findMany.mockResolvedValue(items as never);

    const result = await searchFaq('оплатити');

    expect(mockPrisma.faqItem.findMany).toHaveBeenCalledWith({
      where: {
        isPublished: true,
        OR: [
          { question: { contains: 'оплатити', mode: 'insensitive' } },
          { answer: { contains: 'оплатити', mode: 'insensitive' } },
        ],
      },
      orderBy: { clickCount: 'desc' },
    });
    expect(result).toEqual(items);
  });

  it('should return empty array when no matches found', async () => {
    mockPrisma.faqItem.findMany.mockResolvedValue([] as never);

    const result = await searchFaq('xyz-nonexistent');

    expect(result).toEqual([]);
  });
});

describe('createFaqItem', () => {
  it('should create a FAQ item with all provided fields', async () => {
    const input = {
      category: 'Доставка',
      question: 'Як довго доставляють?',
      answer: '1-3 дні',
      sortOrder: 5,
      isPublished: true,
    };
    const created = { id: 1, ...input, clickCount: 0 };
    mockPrisma.faqItem.create.mockResolvedValue(created as never);

    const result = await createFaqItem(input);

    expect(mockPrisma.faqItem.create).toHaveBeenCalledWith({
      data: {
        category: 'Доставка',
        question: 'Як довго доставляють?',
        answer: '1-3 дні',
        sortOrder: 5,
        isPublished: true,
      },
    });
    expect(result).toEqual(created);
  });

  it('should use default sortOrder 0 when not provided', async () => {
    const input = {
      category: 'Оплата',
      question: 'Які способи оплати?',
      answer: 'Карта, накладений платіж',
    };
    mockPrisma.faqItem.create.mockResolvedValue({ id: 2, ...input, sortOrder: 0, isPublished: true } as never);

    await createFaqItem(input);

    expect(mockPrisma.faqItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sortOrder: 0,
        isPublished: true,
      }),
    });
  });

  it('should use default isPublished true when not provided', async () => {
    const input = {
      category: 'Загальні',
      question: 'Test?',
      answer: 'Answer',
      sortOrder: 1,
    };
    mockPrisma.faqItem.create.mockResolvedValue({ id: 3, ...input, isPublished: true } as never);

    await createFaqItem(input);

    expect(mockPrisma.faqItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isPublished: true,
      }),
    });
  });

  it('should respect isPublished false when explicitly set', async () => {
    const input = {
      category: 'Загальні',
      question: 'Draft?',
      answer: 'Draft answer',
      isPublished: false,
    };
    mockPrisma.faqItem.create.mockResolvedValue({ id: 4, ...input, sortOrder: 0 } as never);

    await createFaqItem(input);

    expect(mockPrisma.faqItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isPublished: false,
      }),
    });
  });
});

describe('updateFaqItem', () => {
  it('should update an existing FAQ item', async () => {
    const existing = { id: 1, category: 'Доставка', question: 'Old?', answer: 'Old' };
    const updateData = { question: 'Updated?', answer: 'Updated answer' };
    const updated = { ...existing, ...updateData };

    mockPrisma.faqItem.findUnique.mockResolvedValue(existing as never);
    mockPrisma.faqItem.update.mockResolvedValue(updated as never);

    const result = await updateFaqItem(1, updateData);

    expect(mockPrisma.faqItem.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(mockPrisma.faqItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: updateData,
    });
    expect(result).toEqual(updated);
  });

  it('should throw FaqError with 404 when item not found', async () => {
    mockPrisma.faqItem.findUnique.mockResolvedValue(null as never);

    await expect(updateFaqItem(999, { question: 'New?' })).rejects.toThrow(FaqError);
    await expect(updateFaqItem(999, { question: 'New?' })).rejects.toThrow('Питання не знайдено');

    try {
      await updateFaqItem(999, {});
    } catch (error) {
      expect((error as FaqError).statusCode).toBe(404);
    }

    expect(mockPrisma.faqItem.update).not.toHaveBeenCalled();
  });

  it('should allow partial updates', async () => {
    mockPrisma.faqItem.findUnique.mockResolvedValue({ id: 1 } as never);
    mockPrisma.faqItem.update.mockResolvedValue({ id: 1, isPublished: false } as never);

    await updateFaqItem(1, { isPublished: false });

    expect(mockPrisma.faqItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isPublished: false },
    });
  });
});

describe('deleteFaqItem', () => {
  it('should delete an existing FAQ item', async () => {
    mockPrisma.faqItem.findUnique.mockResolvedValue({ id: 1, question: 'To delete' } as never);
    mockPrisma.faqItem.delete.mockResolvedValue({ id: 1 } as never);

    await deleteFaqItem(1);

    expect(mockPrisma.faqItem.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(mockPrisma.faqItem.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('should throw FaqError with 404 when item not found', async () => {
    mockPrisma.faqItem.findUnique.mockResolvedValue(null as never);

    await expect(deleteFaqItem(999)).rejects.toThrow(FaqError);
    await expect(deleteFaqItem(999)).rejects.toThrow('Питання не знайдено');

    try {
      await deleteFaqItem(999);
    } catch (error) {
      expect((error as FaqError).statusCode).toBe(404);
    }

    expect(mockPrisma.faqItem.delete).not.toHaveBeenCalled();
  });
});

describe('incrementFaqClick', () => {
  it('should increment click count for the given FAQ item', async () => {
    mockPrisma.faqItem.update.mockResolvedValue({ id: 1, clickCount: 11 } as never);

    await incrementFaqClick(1);

    expect(mockPrisma.faqItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { clickCount: { increment: 1 } },
    });
  });
});

describe('getFaqCategories', () => {
  it('should return unique categories from published items', async () => {
    const items = [
      { category: 'Доставка' },
      { category: 'Оплата' },
    ];
    mockPrisma.faqItem.findMany.mockResolvedValue(items as never);

    const result = await getFaqCategories();

    expect(mockPrisma.faqItem.findMany).toHaveBeenCalledWith({
      where: { isPublished: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    expect(result).toEqual(['Доставка', 'Оплата']);
  });

  it('should return empty array when no published items', async () => {
    mockPrisma.faqItem.findMany.mockResolvedValue([] as never);

    const result = await getFaqCategories();
    expect(result).toEqual([]);
  });
});

describe('getAllFaq', () => {
  it('should return all FAQ items ordered by category and sortOrder', async () => {
    const items = [
      { id: 1, category: 'A', question: 'Q1', answer: 'A1', sortOrder: 0, isPublished: true },
      { id: 2, category: 'A', question: 'Q2', answer: 'A2', sortOrder: 1, isPublished: false },
    ];
    mockPrisma.faqItem.findMany.mockResolvedValue(items as never);

    const result = await getAllFaq();

    expect(mockPrisma.faqItem.findMany).toHaveBeenCalledWith({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
    expect(result).toEqual(items);
  });
});
