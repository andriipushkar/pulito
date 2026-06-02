// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Local next-intl mock: resolve real Ukrainian copy (with ICU) from messages so
// translated-text assertions match production, overriding the global passthrough.
vi.mock('next-intl', async (importActual) => {
  const actual = await importActual<any>();
  const uk = (await import('@/messages/uk.json')).default;
  return {
    ...actual,
    useTranslations: (ns?: string) =>
      actual.createTranslator({ locale: 'uk', messages: uk, namespace: ns }),
    useLocale: () => 'uk',
    useFormatter: () => actual.createFormatter({ locale: 'uk' }),
  };
});

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/admin',
}));

import CommandPalette from './CommandPalette';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('CommandPalette', () => {
  it('does not render when closed', () => {
    render(<CommandPalette />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens with Ctrl+K and shows search input', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(
      screen.getByPlaceholderText('Шукай товар, замовлення, клієнта, сторінку…'),
    ).toBeInTheDocument();
  });

  it('shows command items when open', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    // Empty query surfaces Quick Actions first; navigation items follow.
    expect(screen.getByText('+ Створити товар')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('filters commands based on search query', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const input = screen.getByPlaceholderText('Шукай товар, замовлення, клієнта, сторінку…');
    fireEvent.change(input, { target: { value: 'Користувачі' } });
    expect(screen.getByText('Користувачі')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('shows "nothing found" for non-matching query', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const input = screen.getByPlaceholderText('Шукай товар, замовлення, клієнта, сторінку…');
    fireEvent.change(input, { target: { value: 'xyznonexistent' } });
    expect(screen.getByText('Нічого не знайдено')).toBeInTheDocument();
  });

  it('navigates on Enter and closes palette', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const input = screen.getByPlaceholderText('Шукай товар, замовлення, клієнта, сторінку…');
    fireEvent.keyDown(input, { key: 'Enter' });
    // First entry on empty query is the top Quick Action.
    expect(mockPush).toHaveBeenCalledWith('/admin/products/new');
  });

  it('closes on Escape', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const input = screen.getByPlaceholderText('Шукай товар, замовлення, клієнта, сторінку…');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(
      screen.queryByPlaceholderText('Шукай товар, замовлення, клієнта, сторінку…'),
    ).not.toBeInTheDocument();
  });

  it('navigates with arrow keys', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const input = screen.getByPlaceholderText('Шукай товар, замовлення, клієнта, сторінку…');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    // ArrowDown advances from index 0 to 1 — second Quick Action.
    expect(mockPush).toHaveBeenCalledWith('/admin/pages?new=1');
  });
});
