// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let mockPathname = '/admin';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('@/components/icons', () => ({
  Close: ({ size }: { size: number }) => <svg data-testid="close-icon" width={size} />,
}));

import HelpPanel from './HelpPanel';

beforeEach(() => {
  mockPathname = '/admin';
});

afterEach(() => {
  cleanup();
});

function openPanel() {
  const trigger = screen.getByTitle('Довідка (F1)');
  fireEvent.click(trigger);
}

describe('HelpPanel', () => {
  it('renders the trigger button with "?"', () => {
    render(<HelpPanel />);
    const btn = screen.getByTitle('Довідка (F1)');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('?');
  });

  it('opens panel when trigger button is clicked', () => {
    render(<HelpPanel />);
    openPanel();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Довідка')).toBeInTheDocument();
  });

  it('displays help content for the current route', () => {
    mockPathname = '/admin/orders';
    render(<HelpPanel />);
    openPanel();
    expect(screen.getByText('Замовлення')).toBeInTheDocument();
  });

  it('shows steps when available', () => {
    render(<HelpPanel />);
    openPanel();
    expect(screen.getByText('Як користуватись')).toBeInTheDocument();
  });

  it('closes panel when close button is clicked', () => {
    render(<HelpPanel />);
    openPanel();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Закрити'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes panel on Escape key', () => {
    render(<HelpPanel />);
    openPanel();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('toggles panel on F1 key', () => {
    render(<HelpPanel />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'F1' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'F1' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows keyboard shortcuts section in the panel', () => {
    render(<HelpPanel />);
    openPanel();
    expect(screen.getByText('Гарячі клавіші')).toBeInTheDocument();
  });
});
