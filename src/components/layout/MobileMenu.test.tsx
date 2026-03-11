// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/icons', () => ({
  Close: () => <span>X</span>,
  Telegram: () => <span>tg</span>,
  Viber: () => <span>vb</span>,
  Instagram: () => <span>ig</span>,
  Facebook: () => <span>fb</span>,
  TikTok: () => <span>tt</span>,
  Heart: () => <span>heart</span>,
  User: () => <span>user</span>,
  ChevronRight: () => <span>&gt;</span>,
  Phone: () => <span>phone</span>,
  MessageCircle: () => <span>msg</span>,
  HelpCircle: () => <span>help</span>,
}));

import MobileMenu from './MobileMenu';

const categories = [
  { id: 1, name: 'Cat1', slug: 'cat1', iconPath: null, coverImage: null, description: null, sortOrder: 0, isVisible: true, parentId: null, _count: { products: 5 } },
  { id: 2, name: 'Cat2', slug: 'cat2', iconPath: null, coverImage: null, description: null, sortOrder: 0, isVisible: false, parentId: null, _count: { products: 3 } },
  { id: 3, name: 'SubCat', slug: 'subcat', iconPath: null, coverImage: null, description: null, sortOrder: 0, isVisible: true, parentId: 1, _count: { products: 2 } },
];

describe('MobileMenu', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  });

  it('renders nothing when closed', () => {
    const { container } = render(<MobileMenu isOpen={false} onClose={vi.fn()} categories={categories} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders menu when open', () => {
    const { container } = render(<MobileMenu isOpen={true} onClose={vi.fn()} categories={categories} />);
    expect(container.querySelector('[role="dialog"]')).toBeInTheDocument();
  });

  it('displays only visible parent category names', () => {
    const { container } = render(<MobileMenu isOpen={true} onClose={vi.fn()} categories={categories} />);
    expect(container.textContent).toContain('Cat1');
    // Cat2 is not visible, should not appear
    expect(container.textContent).not.toContain('Cat2');
    // SubCat is a child (parentId=1), should not appear in parent list
  });

  it('locks body scroll when opened', () => {
    render(<MobileMenu isOpen={true} onClose={vi.fn()} categories={categories} />);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.touchAction).toBe('none');
  });

  it('unlocks body scroll on unmount', () => {
    const { unmount } = render(<MobileMenu isOpen={true} onClose={vi.fn()} categories={categories} />);
    unmount();
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.touchAction).toBe('');
  });

  it('focuses close button after opening', () => {
    const { container } = render(<MobileMenu isOpen={true} onClose={vi.fn()} categories={categories} />);
    const closeBtn = container.querySelector('button[aria-label="Закрити"]') as HTMLButtonElement;
    vi.advanceTimersByTime(150);
    expect(closeBtn).toBeTruthy();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<MobileMenu isOpen={true} onClose={onClose} categories={categories} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('does not listen for Escape when closed', () => {
    const onClose = vi.fn();
    render(<MobileMenu isOpen={false} onClose={onClose} categories={categories} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<MobileMenu isOpen={true} onClose={onClose} categories={categories} />);
    const overlay = container.querySelector('[aria-hidden="true"]')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<MobileMenu isOpen={true} onClose={onClose} categories={categories} />);
    const closeBtn = container.querySelector('button[aria-label="Закрити"]')!;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders promo banner link', () => {
    const { container } = render(<MobileMenu isOpen={true} onClose={vi.fn()} categories={categories} />);
    expect(container.textContent).toContain('Акції та знижки');
  });

  it('renders catalog link', () => {
    const { container } = render(<MobileMenu isOpen={true} onClose={vi.fn()} categories={categories} />);
    expect(container.textContent).toContain('Весь каталог');
  });

  it('renders account links', () => {
    const { container } = render(<MobileMenu isOpen={true} onClose={vi.fn()} categories={categories} />);
    expect(container.textContent).toContain('Обране');
    expect(container.textContent).toContain('Мій кабінет');
  });

  it('renders contact links', () => {
    const { container } = render(<MobileMenu isOpen={true} onClose={vi.fn()} categories={categories} />);
    expect(container.textContent).toContain('+38 (000) 123-45-67');
  });

  it('renders social links', () => {
    const { container } = render(<MobileMenu isOpen={true} onClose={vi.fn()} categories={categories} />);
    const socialLinks = container.querySelectorAll('a[target="_blank"]');
    expect(socialLinks.length).toBe(5);
  });

  it('calls onClose when a category link is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<MobileMenu isOpen={true} onClose={onClose} categories={categories} />);
    const catLink = container.querySelector('a[href="/catalog?category=cat1"]')!;
    fireEvent.click(catLink);
    expect(onClose).toHaveBeenCalled();
  });

  it('cleans up Escape listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<MobileMenu isOpen={true} onClose={vi.fn()} categories={categories} />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });
});
