// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));

import CookieBanner from './CookieBanner';

describe('CookieBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({});
    // Mock crypto.randomUUID
    Object.defineProperty(global, 'crypto', {
      value: { randomUUID: () => 'test-uuid-123' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when consent already given', () => {
    localStorage.setItem('cookie-consent-accepted', 'true');
    const { container } = render(<CookieBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('shows banner when no consent', async () => {
    const { container } = render(<CookieBanner />);
    await waitFor(() => {
      expect(container.textContent).toContain('cookie');
    });
  });

  it('renders accept, reject, and settings buttons', async () => {
    const { container } = render(<CookieBanner />);
    await waitFor(() => {
      expect(container.textContent).toContain('Прийняти');
      expect(container.textContent).toContain('Відхилити все');
      expect(container.textContent).toContain('Налаштувати');
    });
  });

  it('renders privacy policy link', async () => {
    const { container } = render(<CookieBanner />);
    await waitFor(() => {
      const link = container.querySelector('a[href="/pages/privacy-policy"]');
      expect(link).toBeInTheDocument();
      expect(link!.textContent).toContain('Політика конфіденційності');
    });
  });

  it('hides banner and saves consent when Accept All is clicked', async () => {
    const { container } = render(<CookieBanner />);
    await waitFor(() => {
      expect(container.textContent).toContain('Прийняти');
    });

    const acceptBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Прийняти')!;
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });

    const stored = JSON.parse(localStorage.getItem('cookie-consent-accepted')!);
    expect(stored.analytics).toBe(true);
    expect(stored.marketing).toBe(true);
    expect(stored.date).toBeTruthy();
  });

  it('hides banner and saves consent when Reject All is clicked', async () => {
    const { container } = render(<CookieBanner />);
    await waitFor(() => {
      expect(container.textContent).toContain('Відхилити все');
    });

    const rejectBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Відхилити все')!;
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });

    const stored = JSON.parse(localStorage.getItem('cookie-consent-accepted')!);
    expect(stored.analytics).toBe(false);
    expect(stored.marketing).toBe(false);
  });

  it('sends consent to API on accept', async () => {
    const { container } = render(<CookieBanner />);
    await waitFor(() => {
      expect(container.textContent).toContain('Прийняти');
    });

    const acceptBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Прийняти')!;
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/cookie-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: expect.any(String),
      });
    });
  });

  it('opens settings panel when Налаштувати is clicked', async () => {
    const { container } = render(<CookieBanner />);
    await waitFor(() => {
      expect(container.textContent).toContain('Налаштувати');
    });

    const settingsBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Налаштувати')!;
    fireEvent.click(settingsBtn);

    expect(container.textContent).toContain('Налаштування cookie');
    expect(container.textContent).toContain('Необхідні (завжди активні)');
    expect(container.textContent).toContain('Аналітичні');
    expect(container.textContent).toContain('Маркетингові');
  });

  it('goes back from settings to main banner', async () => {
    const { container } = render(<CookieBanner />);
    await waitFor(() => {
      expect(container.textContent).toContain('Налаштувати');
    });

    const settingsBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Налаштувати')!;
    fireEvent.click(settingsBtn);

    const backBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Назад')!;
    fireEvent.click(backBtn);

    expect(container.textContent).toContain('Прийняти');
    expect(container.textContent).not.toContain('Налаштування cookie');
  });

  it('toggles analytics checkbox in settings', async () => {
    const { container } = render(<CookieBanner />);
    await waitFor(() => {
      expect(container.textContent).toContain('Налаштувати');
    });

    const settingsBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Налаштувати')!;
    fireEvent.click(settingsBtn);

    const checkboxes = container.querySelectorAll('input[type="checkbox"]:not(:disabled)');
    // First non-disabled checkbox is analytics (checked by default), second is marketing
    const analyticsCheckbox = checkboxes[0] as HTMLInputElement;
    expect(analyticsCheckbox.checked).toBe(true);

    fireEvent.change(analyticsCheckbox, { target: { checked: false } });
    expect(analyticsCheckbox.checked).toBe(false);
  });

  it('toggles marketing checkbox in settings', async () => {
    const { container } = render(<CookieBanner />);
    await waitFor(() => {
      expect(container.textContent).toContain('Налаштувати');
    });

    const settingsBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Налаштувати')!;
    fireEvent.click(settingsBtn);

    const checkboxes = container.querySelectorAll('input[type="checkbox"]:not(:disabled)');
    const marketingCheckbox = checkboxes[1] as HTMLInputElement;
    expect(marketingCheckbox.checked).toBe(false);

    fireEvent.change(marketingCheckbox, { target: { checked: true } });
    expect(marketingCheckbox.checked).toBe(true);
  });

  it('saves custom settings when Зберегти is clicked with defaults', async () => {
    const { container } = render(<CookieBanner />);
    await waitFor(() => {
      expect(container.textContent).toContain('Налаштувати');
    });

    // Open settings
    const settingsBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Налаштувати')!;
    fireEvent.click(settingsBtn);

    // Save with defaults (analytics=true, marketing=false)
    const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Зберегти')!;
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });

    const stored = JSON.parse(localStorage.getItem('cookie-consent-accepted')!);
    expect(stored.analytics).toBe(true);
    expect(stored.marketing).toBe(false);
  });

  it('handles localStorage errors gracefully (SSR/private)', () => {
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = () => { throw new Error('blocked'); };

    expect(() => render(<CookieBanner />)).not.toThrow();

    localStorage.getItem = originalGetItem;
  });

  it('handles API failure gracefully when saving consent', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    const { container } = render(<CookieBanner />);
    await waitFor(() => {
      expect(container.textContent).toContain('Прийняти');
    });

    const acceptBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Прийняти')!;
    fireEvent.click(acceptBtn);

    // Should still hide the banner and save locally
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
    expect(localStorage.getItem('cookie-consent-accepted')).toBeTruthy();
  });
});
