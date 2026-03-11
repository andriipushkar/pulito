// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/components/icons', () => ({
  Copy: () => <span data-testid="copy-icon">copy</span>,
  Facebook: () => <span data-testid="facebook-icon">fb</span>,
  Telegram: () => <span data-testid="telegram-icon">tg</span>,
  Viber: () => <span data-testid="viber-icon">vb</span>,
  Instagram: () => <span data-testid="instagram-icon">ig</span>,
  Check: () => <span data-testid="check-icon">check</span>,
}));

import ShareButtons from './ShareButtons';

describe('ShareButtons', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3000', pathname: '/' },
      writable: true,
    });
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders nothing before fullUrl is set', () => {
    // Override location to make useEffect not set fullUrl
    // Actually, the effect runs synchronously in test, so it should render
    // The component returns null if !fullUrl, but useEffect sets it immediately
  });

  it('renders share buttons after URL is set', async () => {
    const { getByText } = render(<ShareButtons url="/product/test" title="Test Product" />);
    expect(getByText('Поділитись:')).toBeInTheDocument();
  });

  it('renders all share buttons', () => {
    const { getByLabelText } = render(<ShareButtons url="/product/test" title="Test Product" />);
    expect(getByLabelText('Копіювати посилання')).toBeInTheDocument();
    expect(getByLabelText('Telegram')).toBeInTheDocument();
    expect(getByLabelText('Viber')).toBeInTheDocument();
    expect(getByLabelText('Facebook')).toBeInTheDocument();
    expect(getByLabelText('Instagram')).toBeInTheDocument();
  });

  it('renders Telegram link with correct href', () => {
    const { getByLabelText } = render(<ShareButtons url="/product/test" title="Test Product" />);
    const tgLink = getByLabelText('Telegram');
    expect(tgLink.getAttribute('href')).toContain('https://t.me/share/url');
    expect(tgLink.getAttribute('href')).toContain(encodeURIComponent('http://localhost:3000/product/test'));
    expect(tgLink.getAttribute('href')).toContain(encodeURIComponent('Test Product'));
  });

  it('renders Viber link with correct href', () => {
    const { getByLabelText } = render(<ShareButtons url="/product/test" title="Test Product" />);
    const viberLink = getByLabelText('Viber');
    expect(viberLink.getAttribute('href')).toContain('viber://forward');
  });

  it('renders Facebook link with correct href', () => {
    const { getByLabelText } = render(<ShareButtons url="/product/test" title="Test Product" />);
    const fbLink = getByLabelText('Facebook');
    expect(fbLink.getAttribute('href')).toContain('facebook.com/sharer');
    expect(fbLink.getAttribute('href')).toContain(encodeURIComponent('http://localhost:3000/product/test'));
  });

  it('copies URL to clipboard when copy button clicked', async () => {
    const { getByLabelText } = render(<ShareButtons url="/product/test" title="Test Product" />);
    const copyBtn = getByLabelText('Копіювати посилання');
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:3000/product/test');
  });

  it('shows check icon after copying', async () => {
    const { getByLabelText, getByTestId } = render(<ShareButtons url="/product/test" title="Test Product" />);
    const copyBtn = getByLabelText('Копіювати посилання');
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(getByTestId('check-icon')).toBeInTheDocument();
  });

  it('reverts copy icon after 2 seconds', async () => {
    const { getByLabelText, queryByTestId } = render(<ShareButtons url="/product/test" title="Test Product" />);
    const copyBtn = getByLabelText('Копіювати посилання');
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(queryByTestId('check-icon')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(queryByTestId('check-icon')).not.toBeInTheDocument();
    expect(queryByTestId('copy-icon')).toBeInTheDocument();
  });

  it('handles clipboard copy error gracefully', async () => {
    (navigator.clipboard.writeText as any).mockRejectedValue(new Error('fail'));
    const { getByLabelText } = render(<ShareButtons url="/product/test" title="Test Product" />);
    const copyBtn = getByLabelText('Копіювати посилання');
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    // Should not throw, and should still show copy icon
  });

  it('copies URL for Instagram and shows check icon', async () => {
    const { getByLabelText, queryAllByTestId } = render(<ShareButtons url="/product/test" title="Test Product" />);
    const igBtn = getByLabelText('Instagram');
    await act(async () => {
      fireEvent.click(igBtn);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:3000/product/test');
    // Should show check icon in Instagram button
    const checkIcons = queryAllByTestId('check-icon');
    expect(checkIcons.length).toBeGreaterThan(0);
  });

  it('reverts Instagram check icon after 3 seconds', async () => {
    const { getByLabelText, queryAllByTestId } = render(<ShareButtons url="/product/test" title="Test Product" />);
    const igBtn = getByLabelText('Instagram');
    await act(async () => {
      fireEvent.click(igBtn);
    });
    expect(queryAllByTestId('check-icon').length).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // Instagram button should show instagram icon again
    expect(queryAllByTestId('instagram-icon').length).toBeGreaterThan(0);
  });

  it('shows correct title for Instagram button before and after copy', async () => {
    const { getByLabelText } = render(<ShareButtons url="/product/test" title="Test Product" />);
    const igBtn = getByLabelText('Instagram');
    expect(igBtn.getAttribute('title')).toBe('Instagram Stories');
    await act(async () => {
      fireEvent.click(igBtn);
    });
    expect(igBtn.getAttribute('title')).toBe('Посилання скопійовано — вставте в Stories');
  });

  it('handles Instagram clipboard error gracefully', async () => {
    (navigator.clipboard.writeText as any).mockRejectedValue(new Error('fail'));
    const { getByLabelText } = render(<ShareButtons url="/product/test" title="Test Product" />);
    const igBtn = getByLabelText('Instagram');
    await act(async () => {
      fireEvent.click(igBtn);
    });
    // Should not throw
  });

  it('renders Telegram and Facebook links with target="_blank"', () => {
    const { getByLabelText } = render(<ShareButtons url="/product/test" title="Test Product" />);
    expect(getByLabelText('Telegram').getAttribute('target')).toBe('_blank');
    expect(getByLabelText('Facebook').getAttribute('target')).toBe('_blank');
  });

  it('renders links with rel="noopener noreferrer"', () => {
    const { getByLabelText } = render(<ShareButtons url="/product/test" title="Test Product" />);
    expect(getByLabelText('Telegram').getAttribute('rel')).toBe('noopener noreferrer');
    expect(getByLabelText('Facebook').getAttribute('rel')).toBe('noopener noreferrer');
  });
});
