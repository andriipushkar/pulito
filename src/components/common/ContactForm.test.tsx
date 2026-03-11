// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));
vi.mock('@/components/ui/PhoneInput', () => ({
  cleanPhone: (v: string) => v.replace(/\D/g, ''),
}));

import ContactForm from './ContactForm';

function q(container: HTMLElement, placeholder: string): HTMLInputElement {
  return container.querySelector(`input[placeholder="${placeholder}"], textarea[placeholder="${placeholder}"]`) as HTMLInputElement;
}

function btn(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('button[type="submit"]') as HTMLButtonElement;
}

function fillAndSubmit(container: HTMLElement) {
  fireEvent.change(q(container, "Ваше ім'я *"), { target: { value: 'Тест' } });
  fireEvent.change(q(container, 'Email *'), { target: { value: 'test@test.com' } });
  fireEvent.change(q(container, 'Повідомлення *'), { target: { value: 'Hello' } });
  fireEvent.submit(btn(container).closest('form')!);
}

describe('ContactForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all form fields and submit button', () => {
    const { container } = render(<ContactForm />);
    expect(q(container, "Ваше ім'я *")).toBeTruthy();
    expect(q(container, 'Email *')).toBeTruthy();
    expect(q(container, '+38 (0XX) XXX-XX-XX')).toBeTruthy();
    expect(q(container, 'Тема')).toBeTruthy();
    expect(q(container, 'Повідомлення *')).toBeTruthy();
    expect(btn(container).textContent).toContain('Надіслати');
  });

  it('renders honeypot field hidden from users', () => {
    const { container } = render(<ContactForm />);
    const honeypot = container.querySelector('input[name="website"]');
    expect(honeypot).toBeTruthy();
    expect(honeypot!.getAttribute('aria-hidden')).toBe('true');
    expect(honeypot!.getAttribute('tabIndex')).toBe('-1');
  });

  it('updates name field on input change', () => {
    const { container } = render(<ContactForm />);
    const nameInput = q(container, "Ваше ім'я *");
    fireEvent.change(nameInput, { target: { value: 'Тест' } });
    expect(nameInput.value).toBe('Тест');
  });

  it('updates email field on input change', () => {
    const { container } = render(<ContactForm />);
    const emailInput = q(container, 'Email *');
    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    expect(emailInput.value).toBe('test@test.com');
  });

  it('formats phone number input correctly', () => {
    const { container } = render(<ContactForm />);
    const phoneInput = q(container, '+38 (0XX) XXX-XX-XX');
    fireEvent.change(phoneInput, { target: { value: '0501234567' } });
    expect(phoneInput.value).toBe('+38 (050) 123-45-67');
  });

  it('clears phone field when value is cleared', () => {
    const { container } = render(<ContactForm />);
    const phoneInput = q(container, '+38 (0XX) XXX-XX-XX');
    fireEvent.change(phoneInput, { target: { value: '050' } });
    fireEvent.change(phoneInput, { target: { value: '' } });
    expect(phoneInput.value).toBe('');
  });

  it('shows success toast and clears fields on successful submit', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const { container } = render(<ContactForm />);
    fillAndSubmit(container);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Повідомлення надіслано! Ми зв'яжемося з вами найближчим часом."
      );
    });
    expect(q(container, "Ваше ім'я *").value).toBe('');
    expect(q(container, 'Email *').value).toBe('');
  });

  it('shows error toast on failed server response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Validation failed' }),
    });
    const { container } = render(<ContactForm />);
    fillAndSubmit(container);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Validation failed');
    });
  });

  it('shows default error when server returns no error message', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    const { container } = render(<ContactForm />);
    fillAndSubmit(container);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Помилка при надсиланні');
    });
  });

  it('shows connection error toast on fetch failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    const { container } = render(<ContactForm />);
    fillAndSubmit(container);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Помилка з'єднання. Спробуйте ще раз.");
    });
  });

  it('shows loading state during form submission', async () => {
    let resolvePromise!: (value: unknown) => void;
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );
    const { container } = render(<ContactForm />);
    fillAndSubmit(container);

    await waitFor(() => {
      const submitBtn = btn(container);
      expect(submitBtn.textContent).toContain('Надсилання');
      expect(submitBtn).toBeDisabled();
    }, { timeout: 3000 });

    resolvePromise({ ok: true });

    await waitFor(() => {
      const submitBtn = btn(container);
      expect(submitBtn.textContent).toContain('Надіслати');
      expect(submitBtn).not.toBeDisabled();
    }, { timeout: 3000 });
  });

  it('formats phone with 380 prefix correctly', () => {
    const { container } = render(<ContactForm />);
    const phoneInput = q(container, '+38 (0XX) XXX-XX-XX');
    fireEvent.change(phoneInput, { target: { value: '380501234567' } });
    expect(phoneInput.value).toBe('+38 (050) 123-45-67');
  });

  it('formats phone with 38 prefix (no 0) correctly', () => {
    const { container } = render(<ContactForm />);
    const phoneInput = q(container, '+38 (0XX) XXX-XX-XX');
    fireEvent.change(phoneInput, { target: { value: '38501234567' } });
    expect(phoneInput.value).toBe('+38 (050) 123-45-67');
  });

  it('formats phone with non-zero starting digit', () => {
    const { container } = render(<ContactForm />);
    const phoneInput = q(container, '+38 (0XX) XXX-XX-XX');
    fireEvent.change(phoneInput, { target: { value: '5012345' } });
    expect(phoneInput.value).toMatch(/^\+38 \(050\) 123-45$/);
  });

  it('formats phone with short input (only 3 digits)', () => {
    const { container } = render(<ContactForm />);
    const phoneInput = q(container, '+38 (0XX) XXX-XX-XX');
    fireEvent.change(phoneInput, { target: { value: '050' } });
    expect(phoneInput.value).toBe('+38 (050');
  });

  it('formats phone with 4-6 digits correctly', () => {
    const { container } = render(<ContactForm />);
    const phoneInput = q(container, '+38 (0XX) XXX-XX-XX');
    fireEvent.change(phoneInput, { target: { value: '050123' } });
    expect(phoneInput.value).toBe('+38 (050) 123');
  });

  it('formats phone with 7-8 digits correctly', () => {
    const { container } = render(<ContactForm />);
    const phoneInput = q(container, '+38 (0XX) XXX-XX-XX');
    fireEvent.change(phoneInput, { target: { value: '05012345' } });
    expect(phoneInput.value).toBe('+38 (050) 123-45');
  });

  it('updates subject field on input change', () => {
    const { container } = render(<ContactForm />);
    const subjectInput = q(container, 'Тема');
    fireEvent.change(subjectInput, { target: { value: 'Питання' } });
    expect(subjectInput.value).toBe('Питання');
  });

  it('updates message field on input change', () => {
    const { container } = render(<ContactForm />);
    const messageInput = q(container, 'Повідомлення *');
    fireEvent.change(messageInput, { target: { value: 'Test message' } });
    expect(messageInput.value).toBe('Test message');
  });

  it('updates honeypot field on input change', () => {
    const { container } = render(<ContactForm />);
    const honeypot = container.querySelector('input[name="website"]') as HTMLInputElement;
    fireEvent.change(honeypot, { target: { value: 'bot' } });
    expect(honeypot.value).toBe('bot');
  });

  it('sends correct payload to the feedback API', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const { container } = render(<ContactForm />);
    fireEvent.change(q(container, "Ваше ім'я *"), { target: { value: 'Іван' } });
    fireEvent.change(q(container, 'Email *'), { target: { value: 'ivan@test.com' } });
    fireEvent.change(q(container, 'Тема'), { target: { value: 'Питання' } });
    fireEvent.change(q(container, 'Повідомлення *'), { target: { value: 'Текст' } });
    fireEvent.submit(btn(container).closest('form')!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
      });
    });

    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.name).toBe('Іван');
    expect(body.email).toBe('ivan@test.com');
    expect(body.subject).toBe('Питання');
    expect(body.message).toBe('Текст');
  });
});
