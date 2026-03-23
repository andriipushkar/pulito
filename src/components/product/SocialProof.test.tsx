// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import SocialProof from './SocialProof';

describe('SocialProof', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  it('renders viewers now when viewsCount is high enough', () => {
    render(<SocialProof productId={1} ordersCount={10} viewsCount={500} />);
    expect(screen.getByText(/дивляться зараз/)).toBeInTheDocument();
  });

  it('renders weekly orders when ordersCount > 0', () => {
    render(<SocialProof productId={1} ordersCount={20} viewsCount={100} />);
    expect(screen.getByText(/Куплено .* за тиждень/)).toBeInTheDocument();
  });

  it('renders "Хіт продажів" when ordersCount >= 50', () => {
    render(<SocialProof productId={1} ordersCount={50} viewsCount={100} />);
    expect(screen.getByText('Хіт продажів')).toBeInTheDocument();
  });

  it('does not render "Хіт продажів" when ordersCount < 50', () => {
    render(<SocialProof productId={1} ordersCount={49} viewsCount={100} />);
    expect(screen.queryByText('Хіт продажів')).not.toBeInTheDocument();
  });

  it('renders with minimal props without crashing', () => {
    render(<SocialProof productId={1} ordersCount={0} viewsCount={0} />);
    // Should still render something (at minimum the container)
    expect(screen.queryByText('Хіт продажів')).not.toBeInTheDocument();
  });
});
