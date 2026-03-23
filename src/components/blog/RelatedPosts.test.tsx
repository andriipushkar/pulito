// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/ui/AnimateOnScroll', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

import RelatedPosts from './RelatedPosts';

const makePost = (slug: string, title: string) => ({
  slug,
  title,
  excerpt: 'Excerpt text',
  coverImage: '/img/test.jpg',
  publishedAt: '2025-06-15T10:00:00Z',
  content: 'Some content for reading time estimation',
  category: { name: 'Tips', slug: 'tips' },
});

describe('RelatedPosts', () => {
  it('renders nothing when posts array is empty', () => {
    const { container } = render(<RelatedPosts posts={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the section heading', () => {
    render(<RelatedPosts posts={[makePost('a', 'Post A')]} />);
    expect(screen.getByText('Схожі статті')).toBeInTheDocument();
  });

  it('renders post titles', () => {
    const posts = [makePost('a', 'Post A'), makePost('b', 'Post B')];
    render(<RelatedPosts posts={posts} />);
    expect(screen.getByText('Post A')).toBeInTheDocument();
    expect(screen.getByText('Post B')).toBeInTheDocument();
  });

  it('renders a maximum of 4 posts', () => {
    const posts = Array.from({ length: 6 }, (_, i) => makePost(`p${i}`, `Post ${i}`));
    render(<RelatedPosts posts={posts} />);
    expect(screen.getByText('Post 0')).toBeInTheDocument();
    expect(screen.getByText('Post 3')).toBeInTheDocument();
    expect(screen.queryByText('Post 4')).not.toBeInTheDocument();
  });

  it('renders links to blog posts', () => {
    render(<RelatedPosts posts={[makePost('my-slug', 'My Post')]} />);
    const link = screen.getByRole('link', { name: /My Post/i });
    expect(link.closest('a')).toHaveAttribute('href', '/blog/my-slug');
  });
});
