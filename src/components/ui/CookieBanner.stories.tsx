import type { Meta, StoryObj } from '@storybook/react';
import CookieBanner from './CookieBanner';

const meta: Meta<typeof CookieBanner> = {
  title: 'UI/CookieBanner',
  component: CookieBanner,
  decorators: [
    (Story) => {
      // Remove consent key so the banner always shows
      try {
        localStorage.removeItem('cookie-consent-accepted');
      } catch {}
      return <Story />;
    },
  ],
};

export default meta;
type Story = StoryObj<typeof CookieBanner>;

export const Default: Story = {};
