// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext } from 'react';
import ThemeProvider, { ThemeContext } from './ThemeProvider';

function TestConsumer() {
  const { theme, isLoading, refreshTheme } = useContext(ThemeContext);
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="theme">{theme ? JSON.stringify(theme) : 'null'}</div>
      <div data-testid="display-name">{theme?.displayName ?? 'none'}</div>
      <button onClick={() => refreshTheme()}>Refresh</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.documentElement.style.cssText = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('provides theme context to children', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 1, displayName: 'Default', cssVariables: { '--primary': '#2563eb' } },
      }),
    });

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('display-name').textContent).toBe('Default');
  });

  it('starts with isLoading true', () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('loading').textContent).toBe('true');
  });

  it('loads theme from API and applies CSS variables', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: 2,
          displayName: 'Dark',
          cssVariables: { '--primary': '#000000', '--background': '#1a1a1a' },
        },
      }),
    });

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#000000');
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('#1a1a1a');
  });

  it('falls back to default theme on API error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('theme').textContent).toBe('null');
  });

  it('refreshTheme reloads theme from API', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 1, displayName: 'Light', cssVariables: { '--primary': '#fff' } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 2, displayName: 'Dark', cssVariables: { '--primary': '#000' } },
        }),
      });

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('display-name').textContent).toBe('Light');
    });

    await user.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(screen.getByTestId('display-name').textContent).toBe('Dark');
    });
  });

  it('handles unsuccessful API response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    });

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('theme').textContent).toBe('null');
  });
});
