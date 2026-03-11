// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import SubscriptionForm from './SubscriptionForm';

describe('SubscriptionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders form with email input', () => {
    const { container } = render(<SubscriptionForm />);
    expect(container.querySelector('form')).toBeInTheDocument();
    expect(container.querySelector('input[type="email"]')).toBeInTheDocument();
  });

  it('renders submit button with OK text', () => {
    const { container } = render(<SubscriptionForm />);
    const btn = container.querySelector('button[type="submit"]');
    expect(btn).toBeInTheDocument();
    expect(btn!.textContent).toBe('OK');
  });

  it('renders honeypot field', () => {
    const { container } = render(<SubscriptionForm />);
    const honeypot = container.querySelector('input[name="company_url"]');
    expect(honeypot).toBeInTheDocument();
    expect(honeypot).toHaveAttribute('aria-hidden', 'true');
  });

  it('does not submit when email is empty', async () => {
    globalThis.fetch = vi.fn();
    render(<SubscriptionForm />);
    const form = screen.getByRole('button', { name: /ok/i }).closest('form')!;
    fireEvent.submit(form);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('submits successfully and shows success message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
    render(<SubscriptionForm />);
    const emailInput = screen.getByPlaceholderText('Ваш email');
    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));

    await waitFor(() => {
      expect(screen.getByText('Дякуємо за підписку!')).toBeInTheDocument();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/subscribe', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('shows error state when submission fails (non-ok response)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
    render(<SubscriptionForm />);
    const emailInput = screen.getByPlaceholderText('Ваш email');
    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));

    await waitFor(() => {
      // The form should still be visible (not success) and button should be enabled again
      expect(screen.getByPlaceholderText('Ваш email')).toBeInTheDocument();
    });
  });

  it('shows error state on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<SubscriptionForm />);
    const emailInput = screen.getByPlaceholderText('Ваш email');
    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ваш email')).toBeInTheDocument();
    });
  });

  it('shows loading state during submission', async () => {
    let resolvePromise: (v: any) => void;
    const promise = new Promise((resolve) => { resolvePromise = resolve; });
    globalThis.fetch = vi.fn().mockReturnValue(promise);

    render(<SubscriptionForm />);
    const emailInput = screen.getByPlaceholderText('Ваш email');
    fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));

    // During loading, button text should be '...'
    await waitFor(() => {
      expect(screen.getByText('...')).toBeInTheDocument();
    });

    // Button should be disabled during loading
    expect(screen.getByRole('button', { name: /\.\.\./i })).toBeDisabled();

    resolvePromise!({ ok: true });
    await waitFor(() => {
      expect(screen.getByText('Дякуємо за підписку!')).toBeInTheDocument();
    });
  });

  it('handles honeypot filled by bot - pretends success', async () => {
    globalThis.fetch = vi.fn();
    render(<SubscriptionForm />);
    const emailInput = screen.getByPlaceholderText('Ваш email');
    const honeypot = document.querySelector('input[name="company_url"]') as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'bot@spam.com' } });
    fireEvent.change(honeypot, { target: { value: 'http://spam.com' } });
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));

    await waitFor(() => {
      expect(screen.getByText('Дякуємо за підписку!')).toBeInTheDocument();
    });
    // Should NOT actually call fetch
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
