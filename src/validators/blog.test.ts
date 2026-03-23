import { describe, it, expect } from 'vitest';
import {
  createBlogPostSchema,
  updateBlogPostSchema,
  createBlogCategorySchema,
  updateBlogCategorySchema,
} from './blog';

describe('blog validators', () => {
  describe('createBlogPostSchema', () => {
    const validData = {
      title: 'Test Blog Post',
      content: 'This is the blog content.',
    };

    it('should accept valid data with required fields only', () => {
      const result = createBlogPostSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept valid data with all optional fields', () => {
      const result = createBlogPostSchema.safeParse({
        ...validData,
        slug: 'test-blog-post',
        excerpt: 'Short excerpt',
        coverImage: '/images/cover.jpg',
        categoryId: 1,
        tags: ['tag1', 'tag2'],
        seoTitle: 'SEO Title',
        seoDescription: 'SEO Description',
        isPublished: true,
      });
      expect(result.success).toBe(true);
    });

    it('should reject title shorter than 2 characters', () => {
      const result = createBlogPostSchema.safeParse({ ...validData, title: 'A' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('2 символи');
      }
    });

    it('should reject title longer than 200 characters', () => {
      const result = createBlogPostSchema.safeParse({ ...validData, title: 'A'.repeat(201) });
      expect(result.success).toBe(false);
    });

    it('should reject empty content', () => {
      const result = createBlogPostSchema.safeParse({ ...validData, content: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing content', () => {
      const result = createBlogPostSchema.safeParse({ title: 'Test' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid slug format', () => {
      const result = createBlogPostSchema.safeParse({ ...validData, slug: 'Invalid Slug!' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('малі літери');
      }
    });

    it('should accept valid slug with lowercase letters, numbers, and dashes', () => {
      const result = createBlogPostSchema.safeParse({ ...validData, slug: 'my-blog-post-123' });
      expect(result.success).toBe(true);
    });

    it('should reject excerpt longer than 500 characters', () => {
      const result = createBlogPostSchema.safeParse({ ...validData, excerpt: 'A'.repeat(501) });
      expect(result.success).toBe(false);
    });

    it('should reject non-positive categoryId', () => {
      const result = createBlogPostSchema.safeParse({ ...validData, categoryId: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject more than 20 tags', () => {
      const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
      const result = createBlogPostSchema.safeParse({ ...validData, tags });
      expect(result.success).toBe(false);
    });

    it('should reject tags longer than 50 characters', () => {
      const result = createBlogPostSchema.safeParse({ ...validData, tags: ['A'.repeat(51)] });
      expect(result.success).toBe(false);
    });

    it('should reject seoTitle longer than 160 characters', () => {
      const result = createBlogPostSchema.safeParse({ ...validData, seoTitle: 'A'.repeat(161) });
      expect(result.success).toBe(false);
    });

    it('should reject seoDescription longer than 320 characters', () => {
      const result = createBlogPostSchema.safeParse({ ...validData, seoDescription: 'A'.repeat(321) });
      expect(result.success).toBe(false);
    });
  });

  describe('updateBlogPostSchema', () => {
    it('should accept partial data', () => {
      const result = updateBlogPostSchema.safeParse({ title: 'Updated Title' });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (all fields optional)', () => {
      const result = updateBlogPostSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should still validate field constraints', () => {
      const result = updateBlogPostSchema.safeParse({ title: 'A' });
      expect(result.success).toBe(false);
    });
  });

  describe('createBlogCategorySchema', () => {
    const validData = { name: 'Test Category' };

    it('should accept valid data', () => {
      const result = createBlogCategorySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject name shorter than 2 characters', () => {
      const result = createBlogCategorySchema.safeParse({ name: 'A' });
      expect(result.success).toBe(false);
    });

    it('should reject name longer than 100 characters', () => {
      const result = createBlogCategorySchema.safeParse({ name: 'A'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('should accept valid optional fields', () => {
      const result = createBlogCategorySchema.safeParse({
        ...validData,
        slug: 'test-category',
        description: 'Category description',
        seoTitle: 'SEO Title',
        seoDescription: 'SEO Description',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid slug', () => {
      const result = createBlogCategorySchema.safeParse({ ...validData, slug: 'Bad Slug' });
      expect(result.success).toBe(false);
    });
  });

  describe('updateBlogCategorySchema', () => {
    it('should accept partial data', () => {
      const result = updateBlogCategorySchema.safeParse({ name: 'Updated' });
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = updateBlogCategorySchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});
