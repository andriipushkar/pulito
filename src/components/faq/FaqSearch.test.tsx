// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/components/icons', () => ({
  Search: (props: any) => <span data-testid="search-icon" {...props} />,
}));

import FaqSearch from './FaqSearch';

describe('FaqSearch', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it('renders search input with placeholder', () => {
    render(<FaqSearch onResults={vi.fn()} />);
    const inputs = screen.getAllByPlaceholderText('Пошук у FAQ...');
    expect(inputs[0]).toBeInTheDocument();
  });

  it('renders search icon element', () => {
    render(<FaqSearch onResults={vi.fn()} />);
    expect(screen.getAllByTestId('search-icon')[0]).toBeInTheDocument();
  });



  it('sends API request after debounce for queries of 2+ characters', async () => {
    const mockData = [{ id: 1, question: 'Q1', answer: 'A1', category: 'cat' }];
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: mockData }),
    });

    const onResults = vi.fn();
    const { container } = render(<FaqSearch onResults={onResults} />);
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: 'test' } });
    expect(global.fetch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/faq/search?q=')
      );
    });

    await waitFor(() => {
      expect(onResults).toHaveBeenCalledWith(mockData);
    });
  });

  it('debounces so only the last input value triggers a fetch', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    const onResults = vi.fn();
    const { container } = render(<FaqSearch onResults={onResults} />);
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: 'ab' } });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    fireEvent.change(input, { target: { value: 'abc' } });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it('does not throw when fetch rejects with an error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network'));

    const { container } = render(<FaqSearch onResults={vi.fn()} />);
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: 'test' } });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('does not propagate data to onResults when success is false', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    });

    const onResults = vi.fn();
    const { container } = render(<FaqSearch onResults={onResults} />);
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: 'test' } });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const dataCalls = onResults.mock.calls.filter((c: unknown[]) => c[0] !== null);
    expect(dataCalls).toHaveLength(0);
  });

  it('does not error when onQueryChange prop is omitted', () => {
    const { container } = render(<FaqSearch onResults={vi.fn()} />);
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: 'test' } });
  });

  it('calls onResults(null) when query is less than 2 chars', () => {
    const onResults = vi.fn();
    const { container } = render(<FaqSearch onResults={onResults} />);
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: 'a' } });
    expect(onResults).toHaveBeenCalledWith(null);
  });

  it('calls onQueryChange when provided', () => {
    const onQueryChange = vi.fn();
    const { container } = render(<FaqSearch onResults={vi.fn()} onQueryChange={onQueryChange} />);
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: 'test' } });
    expect(onQueryChange).toHaveBeenCalledWith('test');
  });
});
