// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/components/icons', () => ({
  Phone: () => <span>phone</span>,
  Close: () => <span>X</span>,
}));
vi.mock('@/components/ui/PhoneInput', () => ({
  cleanPhone: (p: string) => p.replace(/\D/g, ''),
}));

import CallbackButton from './CallbackButton';

describe('CallbackButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders trigger button with default class', () => {
    const { container } = render(<CallbackButton />);
    const button = container.querySelector('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Замовити дзвінок');
  });

  it('renders with custom className and iconSize', () => {
    const { container } = render(<CallbackButton triggerClassName="custom-class" iconSize={20} />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('opens modal on trigger click', () => {
    const { container, getByText } = render(<CallbackButton />);
    const button = container.querySelector('button')!;
    fireEvent.click(button);
    expect(getByText('Замовити дзвінок')).toBeInTheDocument();
    expect(getByText('Залиште свої дані і ми зателефонуємо вам')).toBeInTheDocument();
  });

  it('closes modal on overlay click', () => {
    const { container } = render(<CallbackButton />);
    fireEvent.click(container.querySelector('button')!);
    // The overlay is the absolute inset-0 div
    const overlay = document.querySelector('.fixed.inset-0 > .absolute.inset-0') as HTMLElement;
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay);
    expect(document.querySelector('form')).toBeNull();
  });

  it('closes modal on close button click', () => {
    const { container } = render(<CallbackButton />);
    fireEvent.click(container.querySelector('button')!);
    const closeBtn = document.querySelector('[aria-label="Закрити"]') as HTMLElement;
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);
    expect(document.querySelector('form')).toBeNull();
  });

  it('fills in name, phone, preferred time, and honeypot fields', () => {
    const { container } = render(<CallbackButton />);
    fireEvent.click(container.querySelector('button')!);

    const nameInput = document.querySelector('input[placeholder="Ваше ім\'я"]') as HTMLInputElement;
    const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    const select = document.querySelector('select') as HTMLSelectElement;
    const honeypot = document.querySelector('input[name="website"]') as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: 'Тест' } });
    expect(nameInput.value).toBe('Тест');

    fireEvent.change(phoneInput, { target: { value: '0501234567' } });
    expect(phoneInput.value).toBe('+38 (050) 123-45-67');

    fireEvent.change(select, { target: { value: '9:00-12:00' } });
    expect(select.value).toBe('9:00-12:00');

    fireEvent.change(honeypot, { target: { value: 'spam' } });
    expect(honeypot.value).toBe('spam');
  });

  it('phone input handles 380 prefix', () => {
    const { container } = render(<CallbackButton />);
    fireEvent.click(container.querySelector('button')!);
    const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: '380501234567' } });
    expect(phoneInput.value).toBe('+38 (050) 123-45-67');
  });

  it('phone input handles 38 prefix without 0', () => {
    const { container } = render(<CallbackButton />);
    fireEvent.click(container.querySelector('button')!);
    const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: '38501234567' } });
    expect(phoneInput.value).toBe('+38 (050) 123-45-67');
  });

  it('phone input handles non-zero start digit', () => {
    const { container } = render(<CallbackButton />);
    fireEvent.click(container.querySelector('button')!);
    const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: '5012345' } });
    expect(phoneInput.value).toMatch(/^\+38 \(050\) 123-45$/);
  });

  it('phone input clears when empty', () => {
    const { container } = render(<CallbackButton />);
    fireEvent.click(container.querySelector('button')!);
    const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: '050' } });
    fireEvent.change(phoneInput, { target: { value: '' } });
    expect(phoneInput.value).toBe('');
  });

  it('phone input handles short numbers', () => {
    const { container } = render(<CallbackButton />);
    fireEvent.click(container.querySelector('button')!);
    const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: '05' } });
    expect(phoneInput.value).toBe('+38 (05');
  });

  it('submits form successfully and shows success message', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const { container } = render(<CallbackButton />);
    fireEvent.click(container.querySelector('button')!);

    const nameInput = document.querySelector('input[placeholder="Ваше ім\'я"]') as HTMLInputElement;
    const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Тест' } });
    fireEvent.change(phoneInput, { target: { value: '0501234567' } });

    const form = document.querySelector('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Дякуємо');
    });
  });

  it('submits with preferred time in message', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const { container } = render(<CallbackButton />);
    fireEvent.click(container.querySelector('button')!);

    const nameInput = document.querySelector('input[placeholder="Ваше ім\'я"]') as HTMLInputElement;
    const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    const select = document.querySelector('select') as HTMLSelectElement;
    fireEvent.change(nameInput, { target: { value: 'Тест' } });
    fireEvent.change(phoneInput, { target: { value: '0501234567' } });
    fireEvent.change(select, { target: { value: '9:00-12:00' } });

    const form = document.querySelector('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.message).toContain('9:00-12:00');
    });
  });

  it('shows error on fetch failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    const { container } = render(<CallbackButton />);
    fireEvent.click(container.querySelector('button')!);

    const nameInput = document.querySelector('input[placeholder="Ваше ім\'я"]') as HTMLInputElement;
    const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Тест' } });
    fireEvent.change(phoneInput, { target: { value: '0501234567' } });

    const form = document.querySelector('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Помилка');
    });
  });

  it('shows error on non-ok response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
    const { container } = render(<CallbackButton />);
    fireEvent.click(container.querySelector('button')!);

    const nameInput = document.querySelector('input[placeholder="Ваше ім\'я"]') as HTMLInputElement;
    const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Тест' } });
    fireEvent.change(phoneInput, { target: { value: '0501234567' } });

    const form = document.querySelector('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Помилка');
    });
  });

  it('shows loading state during submission', async () => {
    let resolvePromise!: (value: unknown) => void;
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => { resolvePromise = resolve; })
    );
    const { container } = render(<CallbackButton />);
    fireEvent.click(container.querySelector('button')!);

    const nameInput = document.querySelector('input[placeholder="Ваше ім\'y"]') as HTMLInputElement
      || document.querySelector("input[placeholder=\"Ваше ім'я\"]") as HTMLInputElement;
    const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Тест' } });
    fireEvent.change(phoneInput, { target: { value: '0501234567' } });

    const form = document.querySelector('form')!;
    act(() => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Надсилання');
    });

    await act(async () => {
      resolvePromise({ ok: true });
    });
  });

  it('auto-closes modal after success with setTimeout', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const { container } = render(<CallbackButton />);
    fireEvent.click(container.querySelector('button')!);

    const nameInput = document.querySelector("input[placeholder=\"Ваше ім'я\"]") as HTMLInputElement;
    const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Тест' } });
    fireEvent.change(phoneInput, { target: { value: '0501234567' } });

    const form = document.querySelector('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Дякуємо');
    });

    // Verify setTimeout was called with 2000ms
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
    setTimeoutSpy.mockRestore();
  });

  it('auto-closes modal and resets status after 2000ms timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const { container } = render(<CallbackButton />);
    fireEvent.click(container.querySelector('button')!);

    const nameInput = document.querySelector("input[placeholder=\"Ваше ім'я\"]") as HTMLInputElement;
    const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Тест' } });
    fireEvent.change(phoneInput, { target: { value: '0501234567' } });

    const form = document.querySelector('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Дякуємо');
    });

    // Advance past the 2000ms timeout to trigger setIsOpen(false) and setStatus('idle')
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    // Modal should be closed (no form, no success message in portal)
    expect(document.querySelector('form')).toBeNull();
    vi.useRealTimers();
  });
});
