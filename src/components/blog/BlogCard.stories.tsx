import type { Meta, StoryObj } from '@storybook/react';
import BlogCard from './BlogCard';

const meta: Meta<typeof BlogCard> = {
  title: 'Blog/BlogCard',
  component: BlogCard,
};

export default meta;
type Story = StoryObj<typeof BlogCard>;

export const WithImage: Story = {
  args: {
    post: {
      slug: 'how-to-clean',
      title: 'Як правильно прибирати квартиру: повний гайд',
      excerpt: 'Покрокова інструкція з прибирання для тих, хто хоче зробити це ефективно та швидко.',
      coverImage: '/images/banners/banner-1.png',
      publishedAt: '2026-03-15T10:00:00Z',
      category: { name: 'Поради', slug: 'porady' },
      content: 'Lorem ipsum dolor sit amet '.repeat(50),
    },
  },
};

export const WithoutImage: Story = {
  args: {
    post: {
      slug: 'best-detergents',
      title: 'Топ-10 пральних порошків 2026 року',
      excerpt: 'Порівняння найпопулярніших пральних порошків за ефективністю та ціною.',
      coverImage: null,
      publishedAt: '2026-03-10T10:00:00Z',
      category: null,
      content: 'Short content',
    },
  },
};
