// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/components/icons', () => ({ Bell: () => <span data-testid="icon" />, Cart: () => <span data-testid="icon" />, Check: () => <span data-testid="icon" />, ChevronDown: () => <span data-testid="icon" />, ChevronLeft: () => <span data-testid="icon" />, ChevronRight: () => <span data-testid="icon" />, Close: () => <span data-testid="icon" />, Copy: () => <span data-testid="icon" />, Facebook: () => <span data-testid="icon" />, Filter: () => <span data-testid="icon" />, Heart: () => <span data-testid="icon" />, HeartFilled: () => <span data-testid="icon" />, HelpCircle: () => <span data-testid="icon" />, Instagram: () => <span data-testid="icon" />, MessageCircle: () => <span data-testid="icon" />, Minus: () => <span data-testid="icon" />, Phone: () => <span data-testid="icon" />, Plus: () => <span data-testid="icon" />, Search: () => <span data-testid="icon" />, Telegram: () => <span data-testid="icon" />, TikTok: () => <span data-testid="icon" />, Trash: () => <span data-testid="icon" />, User: () => <span data-testid="icon" />, Viber: () => <span data-testid="icon" /> }));

import CheckoutSteps from './CheckoutSteps';

describe('CheckoutSteps', () => {
  it('renders without crashing', () => {
    const { container } = render(<CheckoutSteps currentStep={1} />);
    expect(container).toBeTruthy();
  });

  it('renders all step labels', () => {
    const { getAllByText } = render(<CheckoutSteps currentStep={1} />);
    expect(getAllByText('Контакти').length).toBeGreaterThan(0);
    expect(getAllByText('Доставка').length).toBeGreaterThan(0);
    expect(getAllByText('Оплата').length).toBeGreaterThan(0);
    expect(getAllByText('Підтвердження').length).toBeGreaterThan(0);
  });

  it('renders nav landmark', () => {
    const { getAllByLabelText } = render(<CheckoutSteps currentStep={2} />);
    expect(getAllByLabelText('Кроки оформлення').length).toBeGreaterThan(0);
  });
});
