import type { Meta, StoryObj } from '@storybook/react';
import RelatedPosts from './RelatedPosts';

const makeMockPost = (i: number) => ({
  slug: `post-${i}`,
  title: `Стаття про прибирання #${i}`,
  excerpt: 'Корисні поради для ефективного прибирання вашого дому та офісу.',
  coverImage: null,
  publishedAt: '2025-12-01',
  content: '<p>Зміст статті...</p>',
  category: { name: 'Поради', slug: 'porady' },
});

const meta: Meta<typeof RelatedPosts> = {
  title: 'Blog/RelatedPosts',
  component: RelatedPosts,
};
export default meta;
type Story = StoryObj<typeof RelatedPosts>;

export const Default: Story = {
  args: {
    posts: [makeMockPost(1), makeMockPost(2), makeMockPost(3), makeMockPost(4)],
  },
};

export const TwoPosts: Story = {
  args: {
    posts: [makeMockPost(1), makeMockPost(2)],
  },
};

export const Empty: Story = {
  args: {
    posts: [],
  },
};
