import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  seoTemplate: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  product: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  productContent: {
    upsert: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import {
  getSeoTemplates,
  getSeoTemplateByEntity,
  createSeoTemplate,
  updateSeoTemplate,
  deleteSeoTemplate,
  applyProductTemplate,
  generateProductSeo,
  bulkGenerateProductSeo,
  SeoTemplateError,
} from './seo-template';

describe('seo-template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SeoTemplateError', () => {
    it('creates error with status code', () => {
      const err = new SeoTemplateError('not found', 404);
      expect(err.message).toBe('not found');
      expect(err.statusCode).toBe(404);
      expect(err.name).toBe('SeoTemplateError');
    });

    it('defaults to 400 status code', () => {
      const err = new SeoTemplateError('bad request');
      expect(err.statusCode).toBe(400);
    });
  });

  describe('getSeoTemplates', () => {
    it('calls prisma.seoTemplate.findMany', async () => {
      mockPrisma.seoTemplate.findMany.mockResolvedValue([]);
      const result = await getSeoTemplates();
      expect(mockPrisma.seoTemplate.findMany).toHaveBeenCalledWith({
        orderBy: { entityType: 'asc' },
      });
      expect(result).toEqual([]);
    });
  });

  describe('getSeoTemplateByEntity', () => {
    it('queries by entityType without categoryId', async () => {
      mockPrisma.seoTemplate.findFirst.mockResolvedValue(null);
      await getSeoTemplateByEntity('product');
      expect(mockPrisma.seoTemplate.findFirst).toHaveBeenCalledWith({
        where: { entityType: 'product', categoryId: null },
      });
    });

    it('queries by entityType with categoryId', async () => {
      mockPrisma.seoTemplate.findFirst.mockResolvedValue(null);
      await getSeoTemplateByEntity('product', 5);
      expect(mockPrisma.seoTemplate.findFirst).toHaveBeenCalledWith({
        where: { entityType: 'product', categoryId: 5 },
      });
    });
  });

  describe('createSeoTemplate', () => {
    it('creates a template with scope defaulting to global', async () => {
      mockPrisma.seoTemplate.create.mockResolvedValue({ id: 1 });
      await createSeoTemplate({
        entityType: 'product',
        scope: '',
        titleTemplate: '{name}',
        descriptionTemplate: '{name} desc',
      });
      expect(mockPrisma.seoTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ scope: 'global' }),
      });
    });
  });

  describe('updateSeoTemplate', () => {
    it('throws SeoTemplateError if template not found', async () => {
      mockPrisma.seoTemplate.findUnique.mockResolvedValue(null);
      await expect(updateSeoTemplate(999, { titleTemplate: 'x' })).rejects.toThrow(
        SeoTemplateError
      );
    });

    it('updates an existing template', async () => {
      mockPrisma.seoTemplate.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.seoTemplate.update.mockResolvedValue({ id: 1, titleTemplate: 'updated' });
      const result = await updateSeoTemplate(1, { titleTemplate: 'updated' });
      expect(result.titleTemplate).toBe('updated');
    });
  });

  describe('deleteSeoTemplate', () => {
    it('throws SeoTemplateError if template not found', async () => {
      mockPrisma.seoTemplate.findUnique.mockResolvedValue(null);
      await expect(deleteSeoTemplate(999)).rejects.toThrow(SeoTemplateError);
    });

    it('deletes an existing template', async () => {
      mockPrisma.seoTemplate.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.seoTemplate.delete.mockResolvedValue({ id: 1 });
      await deleteSeoTemplate(1);
      expect(mockPrisma.seoTemplate.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('applyProductTemplate', () => {
    it('replaces template variables', () => {
      const result = applyProductTemplate('{name} - {category} ({price} grn)', {
        name: 'Soap',
        category: 'Cleaning',
        price: '45.00',
      });
      expect(result).toBe('Soap - Cleaning (45.00 grn)');
    });

    it('replaces multiple occurrences', () => {
      const result = applyProductTemplate('{name} | {name}', { name: 'Test' });
      expect(result).toBe('Test | Test');
    });
  });

  describe('generateProductSeo', () => {
    it('throws if product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      await expect(generateProductSeo(999)).rejects.toThrow(SeoTemplateError);
    });

    it('returns null if no template found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 1,
        name: 'Soap',
        code: 'S01',
        priceRetail: 50,
        category: { id: 1, name: 'Cleaning' },
        content: null,
      });
      mockPrisma.seoTemplate.findFirst.mockResolvedValue(null);
      const result = await generateProductSeo(1);
      expect(result).toBeNull();
    });

    it('returns generated seo when template exists', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 1,
        name: 'Soap',
        code: 'S01',
        priceRetail: 50,
        category: { id: 1, name: 'Cleaning' },
        content: null,
      });
      mockPrisma.seoTemplate.findFirst
        .mockResolvedValueOnce(null) // category-specific
        .mockResolvedValueOnce({
          titleTemplate: '{name} - buy',
          descriptionTemplate: '{name} from {price} grn',
          altTemplate: null,
        });
      const result = await generateProductSeo(1);
      expect(result).toEqual({
        seoTitle: 'Soap - buy',
        seoDescription: 'Soap from 50.00 grn',
        imageAlt: undefined,
      });
    });
  });

  describe('bulkGenerateProductSeo', () => {
    it('returns counts of updated products', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 1, name: 'A', code: 'A1', priceRetail: 10, category: { id: 1, name: 'Cat' } },
      ]);
      mockPrisma.seoTemplate.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          titleTemplate: '{name}',
          descriptionTemplate: '{name} desc',
        });
      mockPrisma.productContent.upsert.mockResolvedValue({});
      const result = await bulkGenerateProductSeo();
      expect(result).toEqual({ updated: 1, total: 1 });
    });

    it('skips products without matching template', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 1, name: 'A', code: 'A1', priceRetail: 10, category: null },
      ]);
      mockPrisma.seoTemplate.findFirst.mockResolvedValue(null);
      const result = await bulkGenerateProductSeo();
      expect(result).toEqual({ updated: 0, total: 1 });
    });

    it('handles empty product list', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      const result = await bulkGenerateProductSeo();
      expect(result).toEqual({ updated: 0, total: 0 });
    });

    it('uses category-specific template when available', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 1, name: 'Soap', code: 'S01', priceRetail: 50, category: { id: 3, name: 'Cleaning' } },
      ]);
      // Category-specific template found on first call
      mockPrisma.seoTemplate.findFirst
        .mockResolvedValueOnce({
          titleTemplate: '{name} in {category}',
          descriptionTemplate: '{category}: {name}',
        });
      mockPrisma.productContent.upsert.mockResolvedValue({});
      const result = await bulkGenerateProductSeo();
      expect(result).toEqual({ updated: 1, total: 1 });
      expect(mockPrisma.productContent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            seoTitle: 'Soap in Cleaning',
            seoDescription: 'Cleaning: Soap',
          }),
        })
      );
    });
  });

  describe('generateProductSeo - with altTemplate', () => {
    it('returns imageAlt when altTemplate exists', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 1,
        name: 'Soap',
        code: 'S01',
        priceRetail: 50,
        category: { id: 1, name: 'Cleaning' },
        content: null,
      });
      mockPrisma.seoTemplate.findFirst
        .mockResolvedValueOnce({
          titleTemplate: '{name}',
          descriptionTemplate: '{name} desc',
          altTemplate: '{name} image alt',
        }); // category-specific found first

      const result = await generateProductSeo(1);
      expect(result).toEqual({
        seoTitle: 'Soap',
        seoDescription: 'Soap desc',
        imageAlt: 'Soap image alt',
      });
    });
  });

  describe('generateProductSeo - product without category', () => {
    it('handles product with null category', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 2,
        name: 'Product',
        code: 'P02',
        priceRetail: 30,
        category: null,
        content: null,
      });
      mockPrisma.seoTemplate.findFirst
        .mockResolvedValueOnce(null) // no category-specific (categoryId undefined)
        .mockResolvedValueOnce({
          titleTemplate: '{name} - {code}',
          descriptionTemplate: '{name} for {price}',
          altTemplate: null,
        });

      const result = await generateProductSeo(2);
      expect(result).toEqual({
        seoTitle: 'Product - P02',
        seoDescription: 'Product for 30.00',
        imageAlt: undefined,
      });
    });
  });

  describe('createSeoTemplate - with explicit scope', () => {
    it('uses provided scope value', async () => {
      mockPrisma.seoTemplate.create.mockResolvedValue({ id: 2 });
      await createSeoTemplate({
        entityType: 'category',
        scope: 'category',
        titleTemplate: '{name}',
        descriptionTemplate: '{name} desc',
        categoryId: 5,
      });
      expect(mockPrisma.seoTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ scope: 'category', categoryId: 5 }),
      });
    });
  });

  describe('bulkGenerateProductSeo - null category name fallback (line 136)', () => {
    it('should use empty string for category name when category is null', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 5, name: 'NoCat Product', code: 'NC01', priceRetail: 25, category: null },
      ]);
      // First call for category-specific (categoryId=undefined) returns null
      // Second call for global returns a template
      mockPrisma.seoTemplate.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          titleTemplate: '{name} - {category}',
          descriptionTemplate: '{name} in {category} for {price}',
        });
      mockPrisma.productContent.upsert.mockResolvedValue({});

      const result = await bulkGenerateProductSeo();

      expect(result).toEqual({ updated: 1, total: 1 });
      expect(mockPrisma.productContent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            seoTitle: 'NoCat Product - ',
            seoDescription: 'NoCat Product in  for 25.00',
          }),
        })
      );
    });
  });

  describe('applyProductTemplate - no matching vars', () => {
    it('leaves template unchanged when no matching vars', () => {
      const result = applyProductTemplate('No vars here', {});
      expect(result).toBe('No vars here');
    });
  });
});
