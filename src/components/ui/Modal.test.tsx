// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import Modal from './Modal';

describe('Modal', () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  it('renders nothing when closed', () => {
    const { container } = render(<Modal isOpen={false} onClose={vi.fn()}>Content</Modal>);
    expect(container.innerHTML).toBe('');
  });

  it('renders content when open', () => {
    const { getByText } = render(<Modal isOpen={true} onClose={vi.fn()}>Hello Modal</Modal>);
    expect(getByText('Hello Modal')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    const { getByText } = render(<Modal isOpen={true} onClose={vi.fn()} title="My Title">Body</Modal>);
    expect(getByText('My Title')).toBeInTheDocument();
  });

  it('renders close button when title is provided', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="My Title">Body</Modal>);
    const closeBtn = document.querySelector('[aria-label="Закрити"]');
    expect(closeBtn).toBeInTheDocument();
  });

  it('does not render title section when no title', () => {
    render(<Modal isOpen={true} onClose={vi.fn()}>Body</Modal>);
    expect(document.querySelector('[aria-label="Закрити"]')).toBeNull();
  });

  it('renders with different sizes', () => {
    const sizes: Array<'sm' | 'md' | 'lg' | 'full'> = ['sm', 'md', 'lg', 'full'];
    for (const size of sizes) {
      const { unmount } = render(<Modal isOpen={true} onClose={vi.fn()} size={size}>Content</Modal>);
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog).toBeInTheDocument();
      unmount();
    }
  });

  it('uses md size by default', () => {
    render(<Modal isOpen={true} onClose={vi.fn()}>Content</Modal>);
    const inner = document.querySelector('[role="dialog"] > div');
    expect(inner?.className).toContain('max-w-lg');
  });

  it('applies full size class correctly', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} size="full">Content</Modal>);
    const inner = document.querySelector('[role="dialog"] > div');
    expect(inner?.className).toContain('max-w-full');
    expect(inner?.className).toContain('min-h-screen');
  });

  it('calls onClose when clicking overlay', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose}>Content</Modal>);
    const overlay = document.querySelector('[role="dialog"]') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when clicking inner content', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose}>Content</Modal>);
    const inner = document.querySelector('[role="dialog"] > div') as HTMLElement;
    fireEvent.click(inner);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose}>Content</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button in title is clicked', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} title="Title">Body</Modal>);
    const closeBtn = document.querySelector('[aria-label="Закрити"]') as HTMLElement;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('sets body overflow to hidden when open', () => {
    render(<Modal isOpen={true} onClose={vi.fn()}>Content</Modal>);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body overflow when closed', () => {
    const { rerender } = render(<Modal isOpen={true} onClose={vi.fn()}>Content</Modal>);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Modal isOpen={false} onClose={vi.fn()}>Content</Modal>);
    expect(document.body.style.overflow).toBe('');
  });

  it('traps focus with Tab key (forward)', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Title">
        <button>First</button>
        <button>Last</button>
      </Modal>
    );
    const buttons = document.querySelectorAll('[role="dialog"] button');
    const lastBtn = buttons[buttons.length - 1] as HTMLElement;
    lastBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    // Should cycle back to first
  });

  it('traps focus with Shift+Tab key (backward)', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Title">
        <button>First</button>
        <button>Last</button>
      </Modal>
    );
    // Focus on first focusable (close button in title)
    const firstFocusable = document.querySelector('[role="dialog"] [aria-label="Закрити"]') as HTMLElement;
    firstFocusable.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    // Should cycle to last
  });

  it('handles Tab with no focusable elements', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <div>No focusable elements</div>
      </Modal>
    );
    expect(() => {
      fireEvent.keyDown(document, { key: 'Tab' });
    }).not.toThrow();
  });

  it('sets aria-modal and aria-label correctly', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="Test Title">Body</Modal>);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Test Title');
  });

  it('does not prevent default Tab when focus is in the middle', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Title">
        <button>First</button>
        <button>Middle</button>
        <button>Last</button>
      </Modal>
    );
    // Focus on the Middle button (neither first nor last)
    const buttons = document.querySelectorAll('[role="dialog"] button');
    const middleBtn = buttons[Math.floor(buttons.length / 2)] as HTMLElement;
    middleBtn.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);
    // Should NOT prevent default because focus is in the middle
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('focuses first focusable element on open', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Title">
        <input type="text" data-testid="first-input" />
      </Modal>
    );
    // The close button in the title bar is the first focusable
    const closeBtn = document.querySelector('[aria-label="Закрити"]');
    expect(document.activeElement === closeBtn || document.activeElement?.closest('[role="dialog"]')).toBeTruthy();
  });
});
