// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/ui/AnimateOnScroll', () => ({
  default: ({ children }: any) => <div data-testid="animate">{children}</div>,
}));

import BlogCard from './BlogCard';

const makePost = (overrides: any = {}) => ({
  slug: 'test-post',
  title: 'Test Blog Post',
  excerpt: 'This is a test excerpt for the blog post.',
  coverImage: '/images/test.jpg',
  publishedAt: '2025-06-15T10:00:00Z',
  content: 'word '.repeat(400), // ~400 words => 2 min read
  category: { name: 'Cleaning Tips', slug: 'cleaning-tips' },
  ...overrides,
});

describe('BlogCard', () => {
  it('renders the post title', () => {
    render(<BlogCard post={makePost()} />);
    expect(screen.getByText('Test Blog Post')).toBeInTheDocument();
  });

  it('renders the excerpt', () => {
    render(<BlogCard post={makePost()} />);
    expect(screen.getByText('This is a test excerpt for the blog post.')).toBeInTheDocument();
  });

  it('renders the cover image with correct alt text', () => {
    render(<BlogCard post={makePost()} />);
    const img = screen.getByAltText('Test Blog Post');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/images/test.jpg');
  });

  it('renders the category badge', () => {
    render(<BlogCard post={makePost()} />);
    expect(screen.getByText('Cleaning Tips')).toBeInTheDocument();
  });

  it('does not render category badge when category is null', () => {
    render(<BlogCard post={makePost({ category: null })} />);
    expect(screen.queryByText('Cleaning Tips')).not.toBeInTheDocument();
  });

  it('renders read time estimation', () => {
    render(<BlogCard post={makePost()} />);
    expect(screen.getByText('2 хв читання')).toBeInTheDocument();
  });

  it('renders published date', () => {
    render(<BlogCard post={makePost()} />);
    const timeEl = screen.getByRole('link').querySelector('time');
    expect(timeEl).toBeInTheDocument();
  });

  it('does not render excerpt when it is null', () => {
    render(<BlogCard post={makePost({ excerpt: null })} />);
    expect(screen.queryByText('This is a test excerpt for the blog post.')).not.toBeInTheDocument();
  });

  it('renders placeholder when no cover image', () => {
    render(<BlogCard post={makePost({ coverImage: null })} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('links to the correct blog post URL', () => {
    render(<BlogCard post={makePost()} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/blog/test-post');
  });

  it('renders "Читати далі" call to action', () => {
    render(<BlogCard post={makePost()} />);
    expect(screen.getByText('Читати далі')).toBeInTheDocument();
  });
});
