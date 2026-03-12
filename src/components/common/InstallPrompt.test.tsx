// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import InstallPrompt from './InstallPrompt';

function createPromptEvent(outcome: 'accepted' | 'dismissed' = 'dismissed') {
  const mockPrompt = vi.fn().mockResolvedValue(undefined);
  const promptEvent = new Event('beforeinstallprompt', { cancelable: true });
  Object.assign(promptEvent, {
    prompt: mockPrompt,
    userChoice: Promise.resolve({ outcome }),
  });
  return { promptEvent, mockPrompt };
}

describe('InstallPrompt', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();

    matchMediaMock = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    Object.defineProperty(window, 'matchMedia', {
      value: matchMediaMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders nothing initially (no beforeinstallprompt event)', () => {
    const { container } = render(<InstallPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when app is already installed (standalone mode)', () => {
    matchMediaMock.mockReturnValue({ matches: true });
    const { container } = render(<InstallPrompt />);
    expect(container.innerHTML).toBe('');
  });

  it('shows install banner after beforeinstallprompt event', () => {
    render(<InstallPrompt />);

    const { promptEvent } = createPromptEvent();
    act(() => { window.dispatchEvent(promptEvent); });
    act(() => { vi.advanceTimersByTime(3000); });

    expect(screen.getByText('Встановити Порошок')).toBeInTheDocument();
    expect(screen.getByText('Встановити')).toBeInTheDocument();
    expect(screen.getByText('Не зараз')).toBeInTheDocument();
  });

  it('calls prompt() when install button clicked', async () => {
    render(<InstallPrompt />);

    const { promptEvent, mockPrompt } = createPromptEvent('accepted');
    act(() => { window.dispatchEvent(promptEvent); });
    act(() => { vi.advanceTimersByTime(3000); });

    await act(async () => {
      fireEvent.click(screen.getByText('Встановити'));
    });

    expect(mockPrompt).toHaveBeenCalledOnce();
  });

  it('hides banner and stores dismissal on "Не зараз" click', () => {
    render(<InstallPrompt />);

    const { promptEvent } = createPromptEvent();
    act(() => { window.dispatchEvent(promptEvent); });
    act(() => { vi.advanceTimersByTime(3000); });

    fireEvent.click(screen.getByText('Не зараз'));

    expect(screen.queryByText('Встановити Порошок')).not.toBeInTheDocument();
    expect(localStorage.getItem('pwa-install-dismissed')).toBeTruthy();
  });

  it('does not show banner if dismissed recently', () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());

    render(<InstallPrompt />);

    const { promptEvent } = createPromptEvent();
    act(() => { window.dispatchEvent(promptEvent); });
    act(() => { vi.advanceTimersByTime(3000); });

    expect(screen.queryByText('Встановити Порошок')).not.toBeInTheDocument();
  });

  it('shows banner if dismissed more than 14 days ago', () => {
    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
    localStorage.setItem('pwa-install-dismissed', fifteenDaysAgo.toString());

    render(<InstallPrompt />);

    const { promptEvent } = createPromptEvent();
    act(() => { window.dispatchEvent(promptEvent); });
    act(() => { vi.advanceTimersByTime(3000); });

    expect(screen.getByText('Встановити Порошок')).toBeInTheDocument();
  });

  it('hides banner on appinstalled event', () => {
    render(<InstallPrompt />);

    const { promptEvent } = createPromptEvent();
    act(() => { window.dispatchEvent(promptEvent); });
    act(() => { vi.advanceTimersByTime(3000); });

    expect(screen.getByText('Встановити Порошок')).toBeInTheDocument();

    act(() => { window.dispatchEvent(new Event('appinstalled')); });

    expect(screen.queryByText('Встановити Порошок')).not.toBeInTheDocument();
  });

  it('hides banner via close (X) button', () => {
    render(<InstallPrompt />);

    const { promptEvent } = createPromptEvent();
    act(() => { window.dispatchEvent(promptEvent); });
    act(() => { vi.advanceTimersByTime(3000); });

    fireEvent.click(screen.getByLabelText('Закрити'));

    expect(screen.queryByText('Встановити Порошок')).not.toBeInTheDocument();
  });
});
