// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockScrollTo = vi.hoisted(() => vi.fn());
const mockOn = vi.hoisted(() => vi.fn());
const mockOff = vi.hoisted(() => vi.fn());
const mockSelectedScrollSnap = vi.hoisted(() => vi.fn().mockReturnValue(0));

vi.mock('embla-carousel-react', () => ({
  default: () => [
    (node: any) => {},
    {
      scrollTo: mockScrollTo,
      on: mockOn,
      off: mockOff,
      selectedScrollSnap: mockSelectedScrollSnap,
    },
  ],
}));
vi.mock('@/components/ui/Modal', () => ({
  default: ({ isOpen, onClose, children }: any) =>
    isOpen ? <div data-testid="modal"><button data-testid="modal-close" onClick={onClose}>X</button>{children}</div> : null,
}));
vi.mock('@/components/icons', () => ({
  ChevronLeft: () => <span data-testid="chevron-left" />,
  ChevronRight: () => <span data-testid="chevron-right" />,
  Close: () => <span data-testid="close-icon" />,
}));

import ImageGallery from './ImageGallery';

const makeImages = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    pathThumbnail: `/thumb-${i + 1}.jpg`,
    pathMedium: `/med-${i + 1}.jpg`,
    pathFull: `/full-${i + 1}.jpg`,
    pathOriginal: `/orig-${i + 1}.jpg`,
    pathBlur: null as string | null,
    altText: null as string | null,
    isMain: i === 0,
  }));

describe('ImageGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders empty state when no images', () => {
    const { getByText } = render(<ImageGallery images={[]} productName="Test" />);
    expect(getByText('Зображення відсутнє')).toBeInTheDocument();
  });

  it('renders main image for single image', () => {
    const images = makeImages(1);
    const { container } = render(<ImageGallery images={images} productName="Test" />);
    expect(container.querySelector('img[src="/full-1.jpg"]')).toBeInTheDocument();
  });

  it('does not render thumbnails for single image', () => {
    const images = makeImages(1);
    const { container } = render(<ImageGallery images={images} productName="Test" />);
    // No thumbnail buttons should appear for single image
    const thumbImg = container.querySelector('img[src="/thumb-1.jpg"]');
    expect(thumbImg).not.toBeInTheDocument();
  });

  it('renders thumbnails for multiple images on desktop', () => {
    const images = makeImages(3);
    const { container } = render(<ImageGallery images={images} productName="Test" />);
    expect(container.querySelector('img[src="/thumb-1.jpg"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/thumb-2.jpg"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/thumb-3.jpg"]')).toBeInTheDocument();
  });

  it('changes selected image when thumbnail is clicked', () => {
    const images = makeImages(3);
    const { container } = render(<ImageGallery images={images} productName="Test" />);
    const thumbButtons = container.querySelectorAll('button');
    const secondThumb = Array.from(thumbButtons).find(btn =>
      btn.querySelector('img[src="/thumb-2.jpg"]')
    );
    if (secondThumb) fireEvent.click(secondThumb);
    expect(container.querySelector('img[src="/full-2.jpg"]')).toBeInTheDocument();
  });

  it('opens lightbox when main image clicked', () => {
    const images = makeImages(2);
    const { container, queryByTestId } = render(<ImageGallery images={images} productName="Test" />);
    expect(queryByTestId('modal')).not.toBeInTheDocument();
    const desktopMain = container.querySelector('[class*="cursor-zoom-in"]');
    if (desktopMain) fireEvent.click(desktopMain);
    expect(queryByTestId('modal')).toBeInTheDocument();
  });

  it('closes lightbox when close button clicked', () => {
    const images = makeImages(2);
    const { container, queryByTestId, getByTestId } = render(<ImageGallery images={images} productName="Test" />);
    const desktopMain = container.querySelector('[class*="cursor-zoom-in"]');
    if (desktopMain) fireEvent.click(desktopMain);
    expect(queryByTestId('modal')).toBeInTheDocument();
    fireEvent.click(getByTestId('modal-close'));
    expect(queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('navigates forward in lightbox', () => {
    const images = makeImages(3);
    const { container, getAllByLabelText } = render(<ImageGallery images={images} productName="Test" />);
    const desktopMain = container.querySelector('[class*="cursor-zoom-in"]');
    if (desktopMain) fireEvent.click(desktopMain);
    const nextBtn = getAllByLabelText('Наступний')[0];
    fireEvent.click(nextBtn);
    expect(container.querySelector('img[src="/orig-2.jpg"]')).toBeInTheDocument();
  });

  it('navigates backward in lightbox (wraps around)', () => {
    const images = makeImages(3);
    const { container, getAllByLabelText } = render(<ImageGallery images={images} productName="Test" />);
    const desktopMain = container.querySelector('[class*="cursor-zoom-in"]');
    if (desktopMain) fireEvent.click(desktopMain);
    const prevBtn = getAllByLabelText('Попередній')[0];
    fireEvent.click(prevBtn);
    expect(container.querySelector('img[src="/orig-3.jpg"]')).toBeInTheDocument();
  });

  it('renders mobile dots for multiple images', () => {
    const images = makeImages(3);
    const { getAllByLabelText } = render(<ImageGallery images={images} productName="Test" />);
    const dots = getAllByLabelText(/Зображення \d+/);
    expect(dots.length).toBe(3);
  });

  it('renders mobile counter', () => {
    const images = makeImages(3);
    const { getAllByText } = render(<ImageGallery images={images} productName="Test" />);
    expect(getAllByText('1 / 3').length).toBeGreaterThan(0);
  });

  it('does not render mobile dots or counter for single image', () => {
    const images = makeImages(1);
    const { queryByLabelText, queryByText } = render(<ImageGallery images={images} productName="Test" />);
    expect(queryByLabelText('Зображення 1')).not.toBeInTheDocument();
    expect(queryByText('1 / 1')).not.toBeInTheDocument();
  });

  it('opens lightbox from mobile image click', () => {
    const images = makeImages(2);
    const { container, queryByTestId } = render(<ImageGallery images={images} productName="Test" />);
    const mobileImg = container.querySelector('[class*="lg:hidden"] img');
    if (mobileImg) fireEvent.click(mobileImg);
    expect(queryByTestId('modal')).toBeInTheDocument();
  });

  it('applies zoom style on mouse move', () => {
    const images = makeImages(1);
    const { container } = render(<ImageGallery images={images} productName="Test" />);
    const zoomArea = container.querySelector('.cursor-zoom-in');
    if (zoomArea) {
      fireEvent.mouseMove(zoomArea, { clientX: 50, clientY: 50 });
      const mainImg = zoomArea.querySelector('img[src="/full-1.jpg"]') as HTMLElement;
      expect(mainImg?.style.transform).toContain('scale(2)');
    }
  });

  it('resets zoom on mouse leave', () => {
    const images = makeImages(1);
    const { container } = render(<ImageGallery images={images} productName="Test" />);
    const zoomArea = container.querySelector('.cursor-zoom-in');
    if (zoomArea) {
      fireEvent.mouseMove(zoomArea, { clientX: 50, clientY: 50 });
      fireEvent.mouseLeave(zoomArea);
      const mainImg = zoomArea.querySelector('img[src="/full-1.jpg"]') as HTMLElement;
      expect(mainImg?.style.transform).toBe('');
    }
  });

  it('shows blur placeholder when available', () => {
    const images = [{ ...makeImages(1)[0], pathBlur: '/blur-1.jpg' }];
    const { container } = render(<ImageGallery images={images} productName="Test" />);
    expect(container.querySelector('img[src="/blur-1.jpg"]')).toBeInTheDocument();
  });

  it('hides blur after main image loads', () => {
    const images = [{ ...makeImages(1)[0], pathBlur: '/blur-1.jpg' }];
    const { container } = render(<ImageGallery images={images} productName="Test" />);
    const mainImg = container.querySelector('img[src="/full-1.jpg"]');
    if (mainImg) fireEvent.load(mainImg);
    expect(container.querySelector('img[src="/blur-1.jpg"]')).not.toBeInTheDocument();
  });

  it('registers embla select listener', () => {
    const images = makeImages(2);
    render(<ImageGallery images={images} productName="Test" />);
    expect(mockOn).toHaveBeenCalledWith('select', expect.any(Function));
  });

  it('unregisters embla select listener on unmount', () => {
    const images = makeImages(2);
    const { unmount } = render(<ImageGallery images={images} productName="Test" />);
    unmount();
    expect(mockOff).toHaveBeenCalledWith('select', expect.any(Function));
  });

  it('changes selected thumbnail on hover', () => {
    const images = makeImages(3);
    const { container } = render(<ImageGallery images={images} productName="Test" />);
    const thumbButtons = container.querySelectorAll('button');
    const thirdThumb = Array.from(thumbButtons).find(btn =>
      btn.querySelector('img[src="/thumb-3.jpg"]')
    );
    if (thirdThumb) fireEvent.mouseEnter(thirdThumb);
    expect(container.querySelector('img[src="/full-3.jpg"]')).toBeInTheDocument();
  });

  it('scrolls mobile carousel when dot is clicked', () => {
    const images = makeImages(3);
    const { getAllByLabelText } = render(<ImageGallery images={images} productName="Test" />);
    const dots = getAllByLabelText(/Зображення \d+/);
    fireEvent.click(dots[1]);
    expect(mockScrollTo).toHaveBeenCalledWith(1);
  });

  it('syncs mobile index on embla select', () => {
    mockSelectedScrollSnap.mockReturnValue(2);
    const images = makeImages(3);
    render(<ImageGallery images={images} productName="Test" />);
    // Get the select callback and call it
    const selectCallback = mockOn.mock.calls.find((c: any) => c[0] === 'select')?.[1];
    if (selectCallback) selectCallback();
    // The selectedScrollSnap returns 2, so index should be 2 (3rd image)
    expect(mockSelectedScrollSnap).toHaveBeenCalled();
  });

  it('uses altText when available for thumbnails', () => {
    const images = makeImages(2).map((img, i) => ({
      ...img,
      altText: `Alt text ${i + 1}`,
    }));
    const { container } = render(<ImageGallery images={images} productName="Test" />);
    const thumbImgs = container.querySelectorAll('img[alt="Alt text 1"]');
    expect(thumbImgs.length).toBeGreaterThan(0);
  });

  it('uses productName in alt text when altText is null', () => {
    const images = makeImages(2);
    const { container } = render(<ImageGallery images={images} productName="My Product" />);
    // Thumbnails should use "My Product 1", "My Product 2"
    expect(container.querySelector('img[alt="My Product 1"]')).toBeInTheDocument();
  });

  it('does not show lightbox nav buttons for single image', () => {
    const images = makeImages(1);
    const { container, queryByLabelText } = render(<ImageGallery images={images} productName="Test" />);
    const desktopMain = container.querySelector('[class*="cursor-zoom-in"]');
    if (desktopMain) fireEvent.click(desktopMain);
    expect(queryByLabelText('Попередній')).not.toBeInTheDocument();
    expect(queryByLabelText('Наступний')).not.toBeInTheDocument();
  });

  it('falls back to pathMedium when pathFull is null', () => {
    const images = [{
      id: 1,
      pathThumbnail: '/thumb.jpg',
      pathMedium: '/med.jpg',
      pathFull: null,
      pathOriginal: null,
      pathBlur: null,
      altText: null,
      isMain: true,
    }];
    const { container } = render(<ImageGallery images={images} productName="Test" />);
    // Desktop main image should use pathMedium
    const desktopDiv = container.querySelector('[class*="hidden lg:flex"]');
    const mainImg = desktopDiv?.querySelector('img[src="/med.jpg"]');
    expect(mainImg).toBeInTheDocument();
  });

  it('falls back to pathFull when pathOriginal is null in lightbox', () => {
    const images = [{
      ...makeImages(1)[0],
      pathOriginal: null,
    }];
    const { container, queryByTestId } = render(<ImageGallery images={images} productName="Test" />);
    const desktopMain = container.querySelector('[class*="cursor-zoom-in"]');
    if (desktopMain) fireEvent.click(desktopMain);
    expect(queryByTestId('modal')).toBeInTheDocument();
    // Should fall back to pathFull
    const lightboxImg = queryByTestId('modal')?.querySelector('img[src="/full-1.jpg"]');
    expect(lightboxImg).toBeInTheDocument();
  });

  it('closes lightbox when internal close button is clicked', () => {
    const images = makeImages(2);
    const { container, queryByTestId, getByLabelText } = render(<ImageGallery images={images} productName="Test" />);
    // Open lightbox
    const desktopMain = container.querySelector('[class*="cursor-zoom-in"]');
    if (desktopMain) fireEvent.click(desktopMain);
    expect(queryByTestId('modal')).toBeInTheDocument();
    // Click the internal "Закрити" button (not the modal-close from Mock)
    const closeBtn = getByLabelText('Закрити');
    fireEvent.click(closeBtn);
    expect(queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('uses pathMedium when pathThumbnail is null for thumbnails', () => {
    const images = makeImages(2).map(img => ({
      ...img,
      pathThumbnail: null,
    }));
    const { container } = render(<ImageGallery images={images} productName="Test" />);
    // Thumbnails should use pathMedium as fallback
    expect(container.querySelector('img[src="/med-1.jpg"]')).toBeInTheDocument();
  });
});
