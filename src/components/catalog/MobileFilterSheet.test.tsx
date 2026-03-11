// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/components/ui/Modal', () => ({
  default: ({ isOpen, title, children }: any) => isOpen ? <div role="dialog"><h2>{title}</h2>{children}</div> : null,
}));
vi.mock('./FilterSidebar', () => ({ default: () => <div data-testid="filter-sidebar" /> }));

import MobileFilterSheet from './MobileFilterSheet';

describe('MobileFilterSheet', () => {
  it('returns null when closed', () => {
    const { container } = render(<MobileFilterSheet isOpen={false} onClose={vi.fn()} categories={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders dialog when open', () => {
    render(<MobileFilterSheet isOpen={true} onClose={vi.fn()} categories={[]} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Фільтри')).toBeInTheDocument();
  });
});
