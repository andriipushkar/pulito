import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPostFindUnique = vi.fn();
const mockPostCreate = vi.fn();
const mockPostFindMany = vi.fn();
const mockPostCount = vi.fn();
const mockPostUpdate = vi.fn();
const mockPostDelete = vi.fn();
const mockCategoryFindUnique = vi.fn();
const mockCategoryCreate = vi.fn();
const mockCategoryDelete = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    blogPost: {
      findUnique: (...args: unknown[]) => mockPostFindUnique(...args),
      create: (...args: unknown[]) => mockPostCreate(...args),
      findMany: (...args: unknown[]) => mockPostFindMany(...args),
      count: (...args: unknown[]) => mockPostCount(...args),
      update: (...args: unknown[]) => mockPostUpdate(...args),
      delete: (...args: unknown[]) => mockPostDelete(...args),
    },
    blogCategory: {
      findUnique: (...args: unknown[]) => mockCategoryFindUnique(...args),
      create: (...args: unknown[]) => mockCategoryCreate(...args),
      delete: (...args: unknown[]) => mockCategoryDelete(...args),
    },
  },
}));

vi.mock('@/utils/slug', () => ({
  createSlug: (text: string) => text.toLowerCase().replace(/\s+/g, '-'),
}));

import {
  createPost,
  getPublishedPosts,
  getPostBySlug,
  deletePost,
  createCategory,
  deleteCategory,
} from './blog';

beforeEach(() => vi.clearAllMocks());

describe('createPost', () => {
  it('creates a post with auto-generated slug', async () => {
    mockPostFindUnique.mockResolvedValue(null); // no existing slug
    mockPostCreate.mockResolvedValue({ id: 1, slug: 'my-post', title: 'My Post' });

    const result = await createPost({ title: 'My Post', content: 'Hello' }, 1);

    expect(result.slug).toBe('my-post');
    expect(mockPostCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'My Post',
          slug: 'my-post',
          content: 'Hello',
          authorId: 1,
        }),
      })
    );
  });

  it('throws on duplicate slug', async () => {
    mockPostFindUnique.mockResolvedValue({ id: 99 }); // slug exists

    await expect(createPost({ title: 'My Post', content: 'Hello' }, 1)).rejects.toThrow();
  });
});

describe('getPublishedPosts', () => {
  it('returns paginated results', async () => {
    const posts = [{ id: 1 }, { id: 2 }];
    mockPostFindMany.mockResolvedValue(posts);
    mockPostCount.mockResolvedValue(10);

    const result = await getPublishedPosts(1, 2);

    expect(result).toEqual({ posts, total: 10 });
    expect(mockPostFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 2 })
    );
  });

  it('returns empty for unknown category slug', async () => {
    mockCategoryFindUnique.mockResolvedValue(null);

    const result = await getPublishedPosts(1, 10, 'no-such-cat');

    expect(result).toEqual({ posts: [], total: 0 });
  });
});

describe('getPostBySlug', () => {
  it('increments views and returns post', async () => {
    const post = { id: 5, slug: 'test', isPublished: true };
    mockPostFindUnique.mockResolvedValue(post);
    mockPostUpdate.mockResolvedValue(post);

    const result = await getPostBySlug('test');

    expect(result).toEqual(post);
    expect(mockPostUpdate).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { viewsCount: { increment: 1 } },
    });
  });

  it('returns null for non-existent slug', async () => {
    mockPostFindUnique.mockResolvedValue(null);

    const result = await getPostBySlug('nope');

    expect(result).toBeNull();
    expect(mockPostUpdate).not.toHaveBeenCalled();
  });
});

describe('deletePost', () => {
  it('deletes existing post', async () => {
    mockPostFindUnique.mockResolvedValue({ id: 1 });
    mockPostDelete.mockResolvedValue(undefined);

    await deletePost(1);

    expect(mockPostDelete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('throws for non-existent post', async () => {
    mockPostFindUnique.mockResolvedValue(null);

    await expect(deletePost(999)).rejects.toThrow();
  });
});

describe('createCategory', () => {
  it('creates category with slug', async () => {
    mockCategoryFindUnique.mockResolvedValue(null);
    mockCategoryCreate.mockResolvedValue({ id: 1, name: 'News', slug: 'news' });

    const result = await createCategory({ name: 'News' });

    expect(result.slug).toBe('news');
    expect(mockCategoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'News', slug: 'news' }),
      })
    );
  });
});

describe('deleteCategory', () => {
  it('blocks deletion if category has posts', async () => {
    mockCategoryFindUnique.mockResolvedValue({
      id: 1,
      _count: { posts: 5 },
    });

    await expect(deleteCategory(1)).rejects.toThrow();
    expect(mockCategoryDelete).not.toHaveBeenCalled();
  });

  it('deletes category with no posts', async () => {
    mockCategoryFindUnique.mockResolvedValue({
      id: 1,
      _count: { posts: 0 },
    });
    mockCategoryDelete.mockResolvedValue(undefined);

    await deleteCategory(1);

    expect(mockCategoryDelete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
