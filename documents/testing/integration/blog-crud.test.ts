import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  createCategory,
  createPost,
  getPublishedPosts,
  updatePost,
  deletePost,
  deleteCategory,
  getPostBySlug,
} from '@/services/blog';
import { cleanDatabase, createTestUser, disconnectPrisma } from './helpers';
import { setupTestDB } from './setup';

describe('Blog CRUD (real DB)', () => {
  let author: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    await setupTestDB();
    await cleanDatabase();

    author = await createTestUser({
      fullName: 'Blog Author',
      role: 'admin',
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectPrisma();
  });

  it('should perform a full blog CRUD lifecycle', async () => {
    // 1. Create a category
    const category = await createCategory({
      name: 'Поради з прибирання',
      slug: 'porady-z-prybyrannya',
      description: 'Корисні поради для домашнього прибирання',
    });

    expect(category.id).toBeGreaterThan(0);
    expect(category.name).toBe('Поради з прибирання');
    expect(category.slug).toBe('porady-z-prybyrannya');

    // Verify category exists in DB
    const dbCategory = await prisma.blogCategory.findUnique({
      where: { id: category.id },
    });
    expect(dbCategory).not.toBeNull();
    expect(dbCategory!.name).toBe('Поради з прибирання');

    // 2. Create a post (unpublished by default)
    const post = await createPost(
      {
        title: 'Як правильно мити підлогу',
        slug: 'yak-pravylno-myty-pidlohu',
        content: '<p>Детальна інструкція з миття підлоги...</p>',
        excerpt: 'Корисні поради щодо миття підлоги',
        categoryId: category.id,
        tags: ['прибирання', 'підлога', 'поради'],
        seoTitle: 'Як мити підлогу правильно',
        seoDescription: 'Повний гайд з миття підлоги',
      },
      author.id
    );

    expect(post.id).toBeGreaterThan(0);
    expect(post.title).toBe('Як правильно мити підлогу');
    expect(post.isPublished).toBe(false);
    expect(post.category).not.toBeNull();
    expect(post.category!.name).toBe('Поради з прибирання');

    // 3. Get published posts (should be empty - post is not published)
    const publishedBefore = await getPublishedPosts(1, 10);
    expect(publishedBefore.posts).toHaveLength(0);
    expect(publishedBefore.total).toBe(0);

    // 4. Publish the post
    const publishedPost = await updatePost(post.id, { isPublished: true });
    expect(publishedPost.isPublished).toBe(true);
    expect(publishedPost.publishedAt).not.toBeNull();

    // 5. Get published posts (should have 1)
    const publishedAfter = await getPublishedPosts(1, 10);
    expect(publishedAfter.posts).toHaveLength(1);
    expect(publishedAfter.total).toBe(1);
    expect(publishedAfter.posts[0].title).toBe('Як правильно мити підлогу');
    expect(publishedAfter.posts[0].category!.name).toBe('Поради з прибирання');

    // 6. Get post by slug (should increment views)
    const retrievedPost = await getPostBySlug('yak-pravylno-myty-pidlohu');
    expect(retrievedPost).not.toBeNull();
    expect(retrievedPost!.title).toBe('Як правильно мити підлогу');
    expect(retrievedPost!.viewsCount).toBe(1);

    // Get it again - views should increment
    const retrievedAgain = await getPostBySlug('yak-pravylno-myty-pidlohu');
    expect(retrievedAgain!.viewsCount).toBe(2);

    // 7. Filter by category slug
    const filteredPosts = await getPublishedPosts(1, 10, 'porady-z-prybyrannya');
    expect(filteredPosts.posts).toHaveLength(1);

    // 8. Filter by tag
    const taggedPosts = await getPublishedPosts(1, 10, undefined, 'підлога');
    expect(taggedPosts.posts).toHaveLength(1);

    // Non-existent tag
    const noTagPosts = await getPublishedPosts(1, 10, undefined, 'неіснуючий-тег');
    expect(noTagPosts.posts).toHaveLength(0);

    // 9. Delete the post
    await deletePost(post.id);

    // Verify post is deleted
    const deletedPost = await prisma.blogPost.findUnique({ where: { id: post.id } });
    expect(deletedPost).toBeNull();

    // Published posts should be empty again
    const publishedFinal = await getPublishedPosts(1, 10);
    expect(publishedFinal.total).toBe(0);

    // 10. Delete the category (should succeed now that post is deleted)
    await deleteCategory(category.id);

    const deletedCategory = await prisma.blogCategory.findUnique({
      where: { id: category.id },
    });
    expect(deletedCategory).toBeNull();
  });

  it('should prevent duplicate slugs', async () => {
    const cat = await createCategory({ name: 'Unique Category', slug: 'unique-cat' });

    await expect(
      createCategory({ name: 'Another', slug: 'unique-cat' })
    ).rejects.toThrow(/slug вже існує/i);

    // Clean up
    await prisma.blogCategory.delete({ where: { id: cat.id } });
  });

  it('should prevent deleting a category with posts', async () => {
    const cat = await createCategory({ name: 'Has Posts', slug: 'has-posts' });
    const post = await createPost(
      {
        title: 'Post in Category',
        content: 'Content',
        categoryId: cat.id,
      },
      author.id
    );

    await expect(deleteCategory(cat.id)).rejects.toThrow(
      /неможливо видалити категорію/i
    );

    // Clean up
    await prisma.blogPost.delete({ where: { id: post.id } });
    await prisma.blogCategory.delete({ where: { id: cat.id } });
  });

  it('should update post fields correctly', async () => {
    const post = await createPost(
      {
        title: 'Original Title',
        content: 'Original content',
        tags: ['tag1'],
      },
      author.id
    );

    const updated = await updatePost(post.id, {
      title: 'Updated Title',
      content: 'Updated content',
      tags: ['tag1', 'tag2', 'tag3'],
      seoTitle: 'SEO Title',
    });

    expect(updated.title).toBe('Updated Title');
    expect(updated.tags).toEqual(['tag1', 'tag2', 'tag3']);

    // Verify in DB
    const dbPost = await prisma.blogPost.findUnique({ where: { id: post.id } });
    expect(dbPost!.title).toBe('Updated Title');
    expect(dbPost!.seoTitle).toBe('SEO Title');

    // Clean up
    await prisma.blogPost.delete({ where: { id: post.id } });
  });
});
