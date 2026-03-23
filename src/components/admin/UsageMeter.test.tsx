// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import UsageMeter from './UsageMeter';

afterEach(() => {
  cleanup();
});

describe('UsageMeter', () => {
  it('renders label and usage count', () => {
    render(<UsageMeter label="API Calls" used={50} max={100} />);
    expect(screen.getByText('API Calls')).toBeInTheDocument();
    expect(screen.getByText('50/100')).toBeInTheDocument();
  });

  it('shows correct percentage text', () => {
    render(<UsageMeter label="Storage" used={75} max={100} />);
    expect(screen.getByText('75% використано')).toBeInTheDocument();
  });

  it('applies green color when usage is below 70%', () => {
    const { container } = render(<UsageMeter label="Low" used={30} max={100} />);
    const bar = container.querySelector('.bg-green-500');
    expect(bar).toBeInTheDocument();
    const valueSpan = container.querySelector('.text-green-600');
    expect(valueSpan).toBeInTheDocument();
  });

  it('applies yellow color when usage is between 70-89%', () => {
    const { container } = render(<UsageMeter label="Medium" used={75} max={100} />);
    const bar = container.querySelector('.bg-yellow-500');
    expect(bar).toBeInTheDocument();
    const valueSpan = container.querySelector('.text-yellow-600');
    expect(valueSpan).toBeInTheDocument();
  });

  it('applies red color when usage is 90% or above', () => {
    const { container } = render(<UsageMeter label="High" used={95} max={100} />);
    const bar = container.querySelector('.bg-red-500');
    expect(bar).toBeInTheDocument();
    const valueSpan = container.querySelector('.text-red-600');
    expect(valueSpan).toBeInTheDocument();
  });

  it('sets progress bar width via inline style', () => {
    const { container } = render(<UsageMeter label="Test" used={50} max={100} />);
    const bar = container.querySelector('[style*="width: 50%"]');
    expect(bar).toBeInTheDocument();
  });

  it('caps percentage at 100% when used exceeds max', () => {
    render(<UsageMeter label="Over" used={150} max={100} />);
    expect(screen.getByText('100% використано')).toBeInTheDocument();
  });

  it('handles max of 0 gracefully', () => {
    render(<UsageMeter label="Zero" used={0} max={0} />);
    expect(screen.getByText('0% використано')).toBeInTheDocument();
  });
});
