// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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
    expect(screen.getByPlaceholderText('Перейти до...')).toBeInTheDocument();
  });

  it('shows command items when open', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Замовлення')).toBeInTheDocument();
  });

  it('filters commands based on search query', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const input = screen.getByPlaceholderText('Перейти до...');
    fireEvent.change(input, { target: { value: 'Замовлення' } });
    expect(screen.getByText('Замовлення')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('shows "nothing found" for non-matching query', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const input = screen.getByPlaceholderText('Перейти до...');
    fireEvent.change(input, { target: { value: 'xyznonexistent' } });
    expect(screen.getByText('Нічого не знайдено')).toBeInTheDocument();
  });

  it('navigates on Enter and closes palette', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const input = screen.getByPlaceholderText('Перейти до...');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockPush).toHaveBeenCalledWith('/admin');
  });

  it('closes on Escape', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const input = screen.getByPlaceholderText('Перейти до...');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Перейти до...')).not.toBeInTheDocument();
  });

  it('navigates with arrow keys', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const input = screen.getByPlaceholderText('Перейти до...');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockPush).toHaveBeenCalledWith('/admin/orders');
  });
});
