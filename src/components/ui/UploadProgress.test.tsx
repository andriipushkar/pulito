// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import UploadProgress from './UploadProgress';

describe('UploadProgress', () => {
  it('renders nothing when isUploading is false', () => {
    const { container } = render(<UploadProgress progress={50} isUploading={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when isUploading is true', () => {
    render(<UploadProgress progress={50} isUploading={true} />);
    expect(screen.getByText('Завантаження...')).toBeInTheDocument();
  });

  it('displays progress percentage', () => {
    render(<UploadProgress progress={75} isUploading={true} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders progress bar with correct width', () => {
    const { container } = render(<UploadProgress progress={60} isUploading={true} />);
    const bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar.style.width).toBe('60%');
  });

  it('renders 0% progress', () => {
    render(<UploadProgress progress={0} isUploading={true} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders 100% progress', () => {
    const { container } = render(<UploadProgress progress={100} isUploading={true} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    const bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar.style.width).toBe('100%');
  });
});
