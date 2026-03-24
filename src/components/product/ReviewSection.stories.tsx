import type { Meta, StoryObj } from '@storybook/react';
import ReviewSection from './ReviewSection';
import { apiClient } from '@/lib/api-client';

const mockReviewsResponse = {
  reviews: [
    {
      id: 1,
      rating: 5,
      title: 'Excellent product',
      comment: 'Works great for cleaning, highly recommend.',
      pros: 'Effective, good smell',
      cons: null,
      isVerifiedPurchase: true,
      helpfulCount: 3,
      images: null,
      adminReply: 'Thank you for your feedback!',
      adminReplyAt: '2025-10-20',
      createdAt: '2025-10-15',
      user: { id: 1, fullName: 'John Doe', avatarUrl: null },
    },
    {
      id: 2,
      rating: 3,
      title: null,
      comment: 'Average quality.',
      pros: null,
      cons: 'Price is a bit high',
      isVerifiedPurchase: false,
      helpfulCount: 0,
      images: null,
      adminReply: null,
      adminReplyAt: null,
      createdAt: '2025-10-10',
      user: { id: 2, fullName: 'Jane Smith', avatarUrl: null },
    },
  ],
  stats: {
    averageRating: 4.2,
    totalReviews: 12,
    distribution: { 5: 6, 4: 3, 3: 2, 2: 1, 1: 0 },
  },
  total: 12,
  page: 1,
  limit: 10,
};

const meta: Meta<typeof ReviewSection> = {
  title: 'Product/ReviewSection',
  component: ReviewSection,
  parameters: {
    nextjs: { appDirectory: true },
  },
  decorators: [
    (Story) => {
      const originalGet = apiClient.get;
      apiClient.get = () => Promise.resolve({ success: true, data: mockReviewsResponse } as never);
      const cleanup = () => {
        apiClient.get = originalGet;
      };
      return (
        <>
          {<Story />}
          {void setTimeout(cleanup, 0) as unknown as null}
        </>
      );
    },
  ],
};
export default meta;
type Story = StoryObj<typeof ReviewSection>;

export const WithReviews: Story = {
  args: { productId: 1 },
};
