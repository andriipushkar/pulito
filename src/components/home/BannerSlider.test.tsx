// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockScrollPrev = vi.fn();
const mockScrollNext = vi.fn();
const mockScrollTo = vi.fn();
const mockSelectedScrollSnap = vi.fn().mockReturnValue(0);
let onSelectCallback: (() => void) | null = null;

vi.mock('embla-carousel-react', () => ({
  default: () => [vi.fn(), {
    scrollPrev: mockScrollPrev,
    scrollNext: mockScrollNext,
    scrollTo: mockScrollTo,
    selectedScrollSnap: mockSelectedScrollSnap,
    on: (event: string, cb: () => void) => { if (event === 'select') onSelectCallback = cb; },
    off: vi.fn(),
  }],
}));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/icons', () => ({
  ChevronLeft: () => <span data-testid="chevron-left" />,
  ChevronRight: () => <span data-testid="chevron-right" />,
}));

import BannerSlider from './BannerSlider';

describe('BannerSlider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    onSelectCallback = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing', () => {
    const { container } = render(<BannerSlider />);
    expect(container).toBeTruthy();
  });

  it('renders fallback banners initially', () => {
    const { container } = render(<BannerSlider />);
    const images = container.querySelectorAll('img[src*="banner"]');
    expect(images.length).toBe(3);
  });

  it('scrolls to slide on indicator click', () => {
    const { getAllByLabelText } = render(<BannerSlider />);
    fireEvent.click(getAllByLabelText(/Слайд/)[1]);
    expect(mockScrollTo).toHaveBeenCalledWith(1);
  });

  it('auto-plays and advances slides', () => {
    render(<BannerSlider />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockScrollNext).toHaveBeenCalled();
  });

  it('pauses autoplay on mouse enter', () => {
    const { container } = render(<BannerSlider />);
    const section = container.querySelector('section')!;
    fireEvent.mouseEnter(section);
    mockScrollNext.mockClear();
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(mockScrollNext).not.toHaveBeenCalled();
  });

  it('resumes autoplay on mouse leave', () => {
    const { container } = render(<BannerSlider />);
    const section = container.querySelector('section')!;
    fireEvent.mouseEnter(section);
    fireEvent.mouseLeave(section);
    mockScrollNext.mockClear();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockScrollNext).toHaveBeenCalled();
  });

  it('renders links to banner buttonLink', () => {
    const { container } = render(<BannerSlider />);
    const links = container.querySelectorAll('a');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', '/catalog?promo=true');
  });

  it('calls scrollPrev on prev button click', () => {
    const { getAllByLabelText } = render(<BannerSlider />);
    fireEvent.click(getAllByLabelText('Попередній')[0]);
    expect(mockScrollPrev).toHaveBeenCalled();
  });

  it('calls scrollNext on next button click', () => {
    const { getAllByLabelText } = render(<BannerSlider />);
    fireEvent.click(getAllByLabelText('Наступний')[0]);
    expect(mockScrollNext).toHaveBeenCalled();
  });

  it('updates selectedIndex on embla select event', () => {
    render(<BannerSlider />);
    expect(onSelectCallback).toBeTruthy();
    mockSelectedScrollSnap.mockReturnValue(2);
    act(() => {
      if (onSelectCallback) onSelectCallback();
    });
  });

  it('filters out banners with generic titles and no image', async () => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 10, title: 'Новий банер', subtitle: null, imageDesktop: '', buttonLink: null, buttonText: null },
          { id: 11, title: 'Real Banner', subtitle: null, imageDesktop: '/real.jpg', buttonLink: '/real', buttonText: null },
        ],
      }),
    });

    const { container } = render(<BannerSlider />);
    await waitFor(() => {
      const imgs = container.querySelectorAll('img[src="/real.jpg"]');
      expect(imgs.length).toBe(1);
    });
  });

  it('renders gradient background when banner has no imageDesktop', async () => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 10, title: 'Promo', subtitle: 'Sub', imageDesktop: '', buttonLink: '/promo', buttonText: 'Go' },
        ],
      }),
    });

    const { container } = render(<BannerSlider />);
    await waitFor(() => {
      const gradient = container.querySelector('[class*="bg-gradient-to-br"]');
      expect(gradient).toBeInTheDocument();
    });
  });

  it('keeps fallback banners when API fails', async () => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const { container } = render(<BannerSlider />);
    // Should still show fallback banners
    await waitFor(() => {
      const images = container.querySelectorAll('img[src*="banner"]');
      expect(images.length).toBe(3);
    });
  });

  it('keeps fallback banners when API returns non-ok', async () => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve(null),
    });
    const { container } = render(<BannerSlider />);
    await waitFor(() => {
      const images = container.querySelectorAll('img[src*="banner"]');
      expect(images.length).toBe(3);
    });
  });

  it('keeps fallback banners when API returns empty data', async () => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    const { container } = render(<BannerSlider />);
    await waitFor(() => {
      const images = container.querySelectorAll('img[src*="banner"]');
      expect(images.length).toBe(3);
    });
  });

  it('keeps fallback banners when all fetched banners are generic', async () => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 10, title: 'Новий банер', subtitle: null, imageDesktop: '', buttonLink: null, buttonText: null },
          { id: 11, title: 'Test Banner', subtitle: null, imageDesktop: '', buttonLink: null, buttonText: null },
        ],
      }),
    });

    const { container } = render(<BannerSlider />);
    // All banners are generic (no imageDesktop and generic title), so meaningful.length is 0
    // Should keep fallback banners
    await waitFor(() => {
      const images = container.querySelectorAll('img[src*="banner"]');
      expect(images.length).toBe(3);
    });
  });

  it('renders BannerDecoration for index 1', async () => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 1, title: 'A', subtitle: null, imageDesktop: '', buttonLink: '/', buttonText: null },
          { id: 2, title: 'B', subtitle: null, imageDesktop: '', buttonLink: '/', buttonText: null },
        ],
      }),
    });
    const { container } = render(<BannerSlider />);
    await waitFor(() => {
      expect(container.querySelectorAll('[class*="bg-gradient-to-br"]').length).toBeGreaterThan(0);
    });
  });

  it('renders BannerDecoration for index 2 (default case)', async () => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 1, title: 'A', subtitle: null, imageDesktop: '', buttonLink: '/', buttonText: null },
          { id: 2, title: 'B', subtitle: null, imageDesktop: '', buttonLink: '/', buttonText: null },
          { id: 3, title: 'C', subtitle: null, imageDesktop: '', buttonLink: '/', buttonText: null },
        ],
      }),
    });
    const { container } = render(<BannerSlider />);
    await waitFor(() => {
      expect(container.querySelectorAll('[class*="bg-gradient-to-br"]').length).toBe(3);
    });
  });

  it('highlights numbers and currency in title (highlightGold)', async () => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 10, title: 'Знижка -20% на все', subtitle: null, imageDesktop: '/sale.jpg', buttonLink: '/sale', buttonText: null },
        ],
      }),
    });
    const { container } = render(<BannerSlider />);
    await waitFor(() => {
      // The title should contain the highlighted text with gold gradient
      const goldSpan = container.querySelector('[class*="bg-gradient-to-r"]');
      expect(goldSpan).toBeInTheDocument();
    });
  });

  it('renders banner without buttonLink as link to /', async () => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 10, title: 'No Link', subtitle: null, imageDesktop: '/img.jpg', buttonLink: null, buttonText: null },
        ],
      }),
    });
    const { container } = render(<BannerSlider />);
    await waitFor(() => {
      const link = container.querySelector('a');
      expect(link).toHaveAttribute('href', '/');
    });
  });

  it('loads banners from API and renders title/subtitle/button', async () => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 10, title: 'Big Sale', subtitle: 'Hurry up', imageDesktop: '/sale.jpg', buttonLink: '/sale', buttonText: 'Shop now' },
        ],
      }),
    });

    const { findByText } = render(<BannerSlider />);
    expect(await findByText('Big Sale')).toBeInTheDocument();
    expect(await findByText('Hurry up')).toBeInTheDocument();
    expect(await findByText('Shop now')).toBeInTheDocument();
  });
});
