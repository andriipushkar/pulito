// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    upload: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';
import ReviewImageUpload from './ReviewImageUpload';

const mockUpload = apiClient.upload as ReturnType<typeof vi.fn>;

function createFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe('ReviewImageUpload', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders upload area', () => {
    const { getByTestId, getByText } = render(
      <ReviewImageUpload onChange={onChange} />
    );
    expect(getByTestId('drop-zone')).toBeInTheDocument();
    expect(getByText(/Перетягніть фото сюди/)).toBeInTheDocument();
  });

  it('shows preview after file selection', async () => {
    const { getByTestId, getByAltText } = render(
      <ReviewImageUpload onChange={onChange} />
    );

    const input = getByTestId('file-input') as HTMLInputElement;
    const file = createFile('photo.jpg', 1024, 'image/jpeg');

    // Mock URL.createObjectURL
    const mockUrl = 'blob:http://localhost/mock-url';
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);

    fireEvent.change(input, { target: { files: [file] } });

    expect(getByAltText('Попередній перегляд 1')).toBeInTheDocument();
  });

  it('enforces max 5 images limit', () => {
    const { getByTestId, getByRole } = render(
      <ReviewImageUpload onChange={onChange} />
    );

    const input = getByTestId('file-input') as HTMLInputElement;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');

    // Try to add 6 files at once
    const files = Array.from({ length: 6 }, (_, i) =>
      createFile(`photo${i}.jpg`, 1024, 'image/jpeg')
    );

    fireEvent.change(input, { target: { files } });

    expect(getByRole('alert')).toHaveTextContent(/Максимум 5 фото/);
  });

  it('shows error for invalid file types', () => {
    const { getByTestId, getByRole } = render(
      <ReviewImageUpload onChange={onChange} />
    );

    const input = getByTestId('file-input') as HTMLInputElement;
    const file = createFile('doc.pdf', 1024, 'application/pdf');

    fireEvent.change(input, { target: { files: [file] } });

    expect(getByRole('alert')).toHaveTextContent(/Непідтримуваний формат/);
  });

  it('shows error for oversized files', () => {
    const { getByTestId, getByRole } = render(
      <ReviewImageUpload onChange={onChange} />
    );

    const input = getByTestId('file-input') as HTMLInputElement;
    const file = createFile('big.jpg', 6 * 1024 * 1024, 'image/jpeg');

    fireEvent.change(input, { target: { files: [file] } });

    expect(getByRole('alert')).toHaveTextContent(/перевищує максимальний розмір/);
  });

  it('removes image when remove button is clicked', () => {
    const { getByTestId, getByLabelText, queryByAltText } = render(
      <ReviewImageUpload onChange={onChange} />
    );

    const input = getByTestId('file-input') as HTMLInputElement;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const file = createFile('photo.jpg', 1024, 'image/jpeg');
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(getByLabelText('Видалити зображення 1'));

    expect(queryByAltText('Попередній перегляд 1')).not.toBeInTheDocument();
  });

  it('calls onChange with uploaded URLs after successful upload', async () => {
    const urls = ['/uploads/reviews/1/test.webp'];
    mockUpload.mockResolvedValue({ success: true, data: { urls } });

    const { getByTestId, getByText } = render(
      <ReviewImageUpload onChange={onChange} />
    );

    const input = getByTestId('file-input') as HTMLInputElement;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const file = createFile('photo.jpg', 1024, 'image/jpeg');
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(getByText(/Завантажити 1/));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(urls);
    });
  });

  it('handles drag and drop', () => {
    const { getByTestId, getByAltText } = render(
      <ReviewImageUpload onChange={onChange} />
    );

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');

    const dropZone = getByTestId('drop-zone');
    const file = createFile('photo.jpg', 1024, 'image/jpeg');

    fireEvent.dragOver(dropZone);
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    });

    expect(getByAltText('Попередній перегляд 1')).toBeInTheDocument();
  });

  it('shows remaining count', () => {
    const { getByText } = render(
      <ReviewImageUpload onChange={onChange} maxImages={3} />
    );
    expect(getByText(/Залишилось: 3/)).toBeInTheDocument();
  });
});
