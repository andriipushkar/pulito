// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/ui/Container', () => ({ default: ({ children, ...props }: any) => <div {...props}>{children}</div> }));
vi.mock('@/components/icons', () => ({
  Telegram: () => <span data-testid="icon" />,
  Viber: () => <span data-testid="icon" />,
  Instagram: () => <span data-testid="icon" />,
  Facebook: () => <span data-testid="icon" />,
  TikTok: () => <span data-testid="icon" />,
  Phone: () => <span data-testid="icon" />,
  HelpCircle: () => <span data-testid="icon" />,
  MessageCircle: () => <span data-testid="icon" />,
}));

import TopBar from './TopBar';

describe('TopBar', () => {
  it('renders without crashing', () => {
    const { container } = render(<TopBar />);
    expect(container).toBeTruthy();
  });

  it('renders social link aria-labels', () => {
    const { getAllByLabelText } = render(<TopBar />);
    expect(getAllByLabelText('Telegram').length).toBeGreaterThan(0);
    expect(getAllByLabelText('Instagram').length).toBeGreaterThan(0);
  });
});
