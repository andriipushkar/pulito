// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/components/icons', () => ({
  MessageCircle: ({ size }: any) => <span data-size={size}>msg</span>,
  Close: () => <span>X</span>,
  ChevronRight: ({ className }: any) => <span className={className}>&gt;</span>,
}));

import ChatWidget from './ChatWidget';

describe('ChatWidget', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders trigger button with default class', () => {
    const { container } = render(<ChatWidget />);
    const button = container.querySelector('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Онлайн-чат');
  });

  it('renders with custom className and iconSize', () => {
    const { container } = render(<ChatWidget triggerClassName="custom-chat" iconSize={18} />);
    expect(container.querySelector('.custom-chat')).toBeInTheDocument();
  });

  it('opens chat widget on trigger click', () => {
    const { container } = render(<ChatWidget />);
    fireEvent.click(container.querySelector('button')!);
    expect(document.body.textContent).toContain('Порошок');
    expect(document.body.textContent).toContain('Часті питання та підтримка');
  });

  it('displays FAQ items in the chat', () => {
    const { container } = render(<ChatWidget />);
    fireEvent.click(container.querySelector('button')!);
    expect(document.body.textContent).toContain('Як зробити замовлення?');
    expect(document.body.textContent).toContain('Які способи доставки доступні?');
    expect(document.body.textContent).toContain('Як стати оптовим клієнтом?');
    expect(document.body.textContent).toContain('Як повернути товар?');
    expect(document.body.textContent).toContain('Які способи оплати?');
  });

  it('shows FAQ answer when an FAQ item is clicked', () => {
    const { container } = render(<ChatWidget />);
    fireEvent.click(container.querySelector('button')!);

    // Click the first FAQ item
    const faqButtons = document.querySelectorAll('.space-y-2 button');
    fireEvent.click(faqButtons[0]);

    expect(document.body.textContent).toContain('Додайте товари до кошика');
    expect(document.body.textContent).toContain('Назад до питань');
  });

  it('goes back to FAQ list when back button is clicked', () => {
    const { container } = render(<ChatWidget />);
    fireEvent.click(container.querySelector('button')!);

    // Click an FAQ item
    const faqButtons = document.querySelectorAll('.space-y-2 button');
    fireEvent.click(faqButtons[0]);

    // Click back button
    const backButton = Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Назад до питань')
    );
    expect(backButton).toBeTruthy();
    fireEvent.click(backButton!);

    // Should be back to FAQ list
    expect(document.body.textContent).toContain('Оберіть питання');
  });

  it('closes chat on overlay click', () => {
    const { container } = render(<ChatWidget />);
    fireEvent.click(container.querySelector('button')!);

    const overlay = document.querySelector('.absolute.inset-0.bg-black\\/40') as HTMLElement;
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay);

    expect(document.querySelector('.space-y-2')).toBeNull();
  });

  it('closes chat on close button click', () => {
    const { container } = render(<ChatWidget />);
    fireEvent.click(container.querySelector('button')!);

    const closeBtn = document.querySelector('[aria-label="Закрити чат"]') as HTMLElement;
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);

    expect(document.querySelector('.space-y-2')).toBeNull();
  });

  it('resets selectedFaq when closing', () => {
    const { container } = render(<ChatWidget />);
    fireEvent.click(container.querySelector('button')!);

    // Select an FAQ
    const faqButtons = document.querySelectorAll('.space-y-2 button');
    fireEvent.click(faqButtons[0]);
    expect(document.body.textContent).toContain('Додайте товари до кошика');

    // Close
    const closeBtn = document.querySelector('[aria-label="Закрити чат"]') as HTMLElement;
    fireEvent.click(closeBtn);

    // Re-open - should show FAQ list, not the answer
    fireEvent.click(container.querySelector('button')!);
    expect(document.body.textContent).toContain('Оберіть питання');
  });

  it('renders Telegram link in footer', () => {
    const { container } = render(<ChatWidget />);
    fireEvent.click(container.querySelector('button')!);

    const telegramLink = document.querySelector('a[href*="t.me"]') as HTMLAnchorElement;
    expect(telegramLink).toBeTruthy();
    expect(telegramLink).toHaveAttribute('target', '_blank');
    expect(telegramLink.textContent).toContain('Написати менеджеру в Telegram');
  });

  it('uses NEXT_PUBLIC_TELEGRAM_BOT_URL env var for Telegram link', () => {
    // Default URL should be used when env var is not set
    const { container } = render(<ChatWidget />);
    fireEvent.click(container.querySelector('button')!);
    const link = document.querySelector('a[href*="t.me"]') as HTMLAnchorElement;
    expect(link.href).toContain('PoroshokBot');
  });
});
