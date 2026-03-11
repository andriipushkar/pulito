// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const addItem = vi.fn();
vi.mock('@/hooks/useRecentlyViewed', () => ({ useRecentlyViewed: () => ({ addItem }) }));

import RecentlyViewedTracker from './RecentlyViewedTracker';

describe('RecentlyViewedTracker', () => {
  it('renders null and calls addItem', () => {
    const { container } = render(<RecentlyViewedTracker productId={42} />);
    expect(container.innerHTML).toBe('');
    expect(addItem).toHaveBeenCalledWith(42);
  });
});
