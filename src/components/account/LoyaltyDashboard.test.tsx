// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

const mockUseSWR = vi.fn();

vi.mock('swr', () => ({
  default: (...args: any[]) => mockUseSWR(...args),
}));
vi.mock('@/lib/swr', () => ({ fetcher: vi.fn() }));

import LoyaltyDashboard from './LoyaltyDashboard';

describe('LoyaltyDashboard', () => {
  it('shows empty state when no challenges and no streak', () => {
    mockUseSWR.mockReturnValue({ data: undefined });
    render(<LoyaltyDashboard />);
    expect(screen.getByText('Наразі немає активних челенджів')).toBeInTheDocument();
  });

  it('renders streak section when streak data is available', () => {
    mockUseSWR.mockImplementation((url: string) => {
      if (url.includes('streak')) {
        return { data: { currentStreak: 5, longestStreak: 10, lastOrderDate: '2025-06-01T00:00:00Z' } };
      }
      return { data: undefined };
    });
    render(<LoyaltyDashboard />);
    expect(screen.getByText('Серія покупок')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders current and longest streak labels', () => {
    mockUseSWR.mockImplementation((url: string) => {
      if (url.includes('streak')) {
        return { data: { currentStreak: 3, longestStreak: 7, lastOrderDate: null } };
      }
      return { data: undefined };
    });
    render(<LoyaltyDashboard />);
    expect(screen.getByText('Поточна серія')).toBeInTheDocument();
    expect(screen.getByText('Рекорд')).toBeInTheDocument();
  });

  it('renders challenges heading when challenges exist', () => {
    mockUseSWR.mockImplementation((url: string) => {
      if (url.includes('challenges')) {
        return {
          data: [
            { id: 1, name: 'Test Challenge', description: 'Desc', type: 'order_count', target: 5, reward: 50, currentValue: 2, isCompleted: false, isRewarded: false, endDate: null },
          ],
        };
      }
      return { data: undefined };
    });
    render(<LoyaltyDashboard />);
    expect(screen.getByText('Активні челенджі')).toBeInTheDocument();
  });

  it('renders challenge cards', () => {
    mockUseSWR.mockImplementation((url: string) => {
      if (url.includes('challenges')) {
        return {
          data: [
            { id: 1, name: 'Challenge A', description: 'Desc A', type: 'review', target: 3, reward: 30, currentValue: 1, isCompleted: false, isRewarded: false, endDate: null },
            { id: 2, name: 'Challenge B', description: 'Desc B', type: 'streak', target: 10, reward: 100, currentValue: 5, isCompleted: false, isRewarded: false, endDate: null },
          ],
        };
      }
      return { data: undefined };
    });
    render(<LoyaltyDashboard />);
    expect(screen.getByText('Challenge A')).toBeInTheDocument();
    expect(screen.getByText('Challenge B')).toBeInTheDocument();
  });
});
