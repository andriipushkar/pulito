// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/ui/Button', () => ({ default: ({ children, ...props }: any) => <button {...props}>{children}</button> }));
vi.mock('@/components/icons', () => ({ Bell: () => <span data-testid="icon" />, Cart: () => <span data-testid="icon" />, Check: () => <span data-testid="icon" />, ChevronDown: () => <span data-testid="icon" />, ChevronLeft: () => <span data-testid="icon" />, ChevronRight: () => <span data-testid="icon" />, Close: () => <span data-testid="icon" />, Copy: () => <span data-testid="icon" />, Facebook: () => <span data-testid="icon" />, Filter: () => <span data-testid="icon" />, Heart: () => <span data-testid="icon" />, HeartFilled: () => <span data-testid="icon" />, HelpCircle: () => <span data-testid="icon" />, Instagram: () => <span data-testid="icon" />, MessageCircle: () => <span data-testid="icon" />, Minus: () => <span data-testid="icon" />, Phone: () => <span data-testid="icon" />, Plus: () => <span data-testid="icon" />, Search: () => <span data-testid="icon" />, Telegram: () => <span data-testid="icon" />, TikTok: () => <span data-testid="icon" />, Trash: () => <span data-testid="icon" />, User: () => <span data-testid="icon" />, Viber: () => <span data-testid="icon" /> }));

import OrderSuccess from './OrderSuccess';

describe('OrderSuccess', () => {
  it('renders without crashing', () => {
    const { container } = render(<OrderSuccess orderNumber="12345" />);
    expect(container).toBeTruthy();
  });

  it('renders order number', () => {
    const { getAllByText } = render(<OrderSuccess orderNumber="12345" />);
    expect(getAllByText('12345').length).toBeGreaterThan(0);
  });

  it('renders action links', () => {
    const { getAllByText } = render(<OrderSuccess orderNumber="12345" />);
    expect(getAllByText('Мої замовлення').length).toBeGreaterThan(0);
    expect(getAllByText('Продовжити покупки').length).toBeGreaterThan(0);
  });
});
