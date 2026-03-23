// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import ReviewImageGallery from './ReviewImageGallery';

const images = [
  '/uploads/reviews/1/img1.webp',
  '/uploads/reviews/1/img2.webp',
  '/uploads/reviews/1/img3.webp',
];

describe('ReviewImageGallery', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders thumbnails for given image URLs', () => {
    const { getAllByRole } = render(<ReviewImageGallery images={images} />);
    const buttons = getAllByRole('button');
    expect(buttons).toHaveLength(3);
  });

  it('renders correct alt text for thumbnails', () => {
    const { getByAltText } = render(<ReviewImageGallery images={images} />);
    expect(getByAltText('Фото відгуку 1')).toBeInTheDocument();
    expect(getByAltText('Фото відгуку 2')).toBeInTheDocument();
    expect(getByAltText('Фото відгуку 3')).toBeInTheDocument();
  });

  it('shows empty state when no images', () => {
    const { container } = render(<ReviewImageGallery images={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when images is undefined-like empty array', () => {
    const { container } = render(<ReviewImageGallery images={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('opens lightbox on thumbnail click', () => {
    const { getAllByRole, getByTestId } = render(
      <ReviewImageGallery images={images} />
    );
    const buttons = getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(getByTestId('lightbox')).toBeInTheDocument();
    expect(getByTestId('lightbox-image')).toHaveAttribute('src', images[0]);
  });

  it('shows correct image in lightbox when second thumbnail clicked', () => {
    const { getAllByRole, getByTestId } = render(
      <ReviewImageGallery images={images} />
    );
    const buttons = getAllByRole('button');
    fireEvent.click(buttons[1]);
    expect(getByTestId('lightbox-image')).toHaveAttribute('src', images[1]);
  });

  it('navigates to next image in lightbox', () => {
    const { getAllByRole, getByTestId, getByLabelText } = render(
      <ReviewImageGallery images={images} />
    );
    fireEvent.click(getAllByRole('button')[0]);
    fireEvent.click(getByLabelText('Наступне фото'));
    expect(getByTestId('lightbox-image')).toHaveAttribute('src', images[1]);
  });

  it('navigates to previous image in lightbox (wraps)', () => {
    const { getAllByRole, getByTestId, getByLabelText } = render(
      <ReviewImageGallery images={images} />
    );
    fireEvent.click(getAllByRole('button')[0]);
    fireEvent.click(getByLabelText('Попереднє фото'));
    expect(getByTestId('lightbox-image')).toHaveAttribute('src', images[2]);
  });

  it('closes lightbox on close button click', () => {
    const { getAllByRole, queryByTestId, getByLabelText } = render(
      <ReviewImageGallery images={images} />
    );
    fireEvent.click(getAllByRole('button')[0]);
    expect(queryByTestId('lightbox')).toBeInTheDocument();
    fireEvent.click(getByLabelText('Закрити'));
    expect(queryByTestId('lightbox')).not.toBeInTheDocument();
  });

  it('closes lightbox on Escape key', () => {
    const { getAllByRole, queryByTestId } = render(
      <ReviewImageGallery images={images} />
    );
    fireEvent.click(getAllByRole('button')[0]);
    expect(queryByTestId('lightbox')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(queryByTestId('lightbox')).not.toBeInTheDocument();
  });

  it('closes lightbox on backdrop click', () => {
    const { getAllByRole, queryByTestId, getByTestId } = render(
      <ReviewImageGallery images={images} />
    );
    fireEvent.click(getAllByRole('button')[0]);
    const lightbox = getByTestId('lightbox');
    fireEvent.click(lightbox);
    expect(queryByTestId('lightbox')).not.toBeInTheDocument();
  });

  it('shows image counter in lightbox', () => {
    const { getAllByRole, getByText } = render(
      <ReviewImageGallery images={images} />
    );
    fireEvent.click(getAllByRole('button')[0]);
    expect(getByText('1 / 3')).toBeInTheDocument();
  });

  it('does not show nav buttons for single image', () => {
    const { getByRole, queryByLabelText } = render(
      <ReviewImageGallery images={[images[0]]} />
    );
    fireEvent.click(getByRole('button'));
    expect(queryByLabelText('Попереднє фото')).not.toBeInTheDocument();
    expect(queryByLabelText('Наступне фото')).not.toBeInTheDocument();
  });
});
