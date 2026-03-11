// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/ui/Container', () => ({ default: ({ children, ...props }: any) => <div {...props}>{children}</div> }));
vi.mock('@/components/icons', () => ({ Bell: () => <span data-testid="icon" />, Cart: () => <span data-testid="icon" />, Check: () => <span data-testid="icon" />, ChevronDown: () => <span data-testid="icon" />, ChevronLeft: () => <span data-testid="icon" />, ChevronRight: () => <span data-testid="icon" />, Close: () => <span data-testid="icon" />, Copy: () => <span data-testid="icon" />, Facebook: () => <span data-testid="icon" />, Filter: () => <span data-testid="icon" />, Heart: () => <span data-testid="icon" />, HeartFilled: () => <span data-testid="icon" />, HelpCircle: () => <span data-testid="icon" />, Instagram: () => <span data-testid="icon" />, MessageCircle: () => <span data-testid="icon" />, Minus: () => <span data-testid="icon" />, Phone: () => <span data-testid="icon" />, Plus: () => <span data-testid="icon" />, Search: () => <span data-testid="icon" />, Telegram: () => <span data-testid="icon" />, TikTok: () => <span data-testid="icon" />, Trash: () => <span data-testid="icon" />, User: () => <span data-testid="icon" />, Viber: () => <span data-testid="icon" /> }));
vi.mock('./SubscriptionForm', () => ({ default: () => <div data-testid="subscription-form" /> }));

import Footer from './Footer';

describe('Footer', () => {
  it('renders without crashing', () => {
    const { container } = render(<Footer />);
    expect(container).toBeTruthy();
  });

  it('renders footer element', () => {
    const { container } = render(<Footer />);
    expect(container.querySelector('footer')).toBeInTheDocument();
  });

  it('renders buyer links', () => {
    const { getAllByText } = render(<Footer />);
    expect(getAllByText('Часті питання').length).toBeGreaterThan(0);
  });
});
