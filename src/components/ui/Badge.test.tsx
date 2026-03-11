// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Badge from './Badge';

describe('Badge', () => {
  afterEach(() => { cleanup(); });

  it('renders children', () => {
    render(<Badge>promo</Badge>);
    expect(screen.getByText('promo')).toBeInTheDocument();
  });

  it('applies custom color via style', () => {
    render(<Badge color="#ff0000">Sale</Badge>);
    const el = screen.getByText('Sale');
    expect(el).toHaveStyle({ backgroundColor: '#ff0000' });
  });

  it('applies default color class for known badge types', () => {
    render(<Badge>promo</Badge>);
    const el = screen.getByText('promo');
    expect(el.className).toContain('bg-gradient-to-r');
  });

  it('applies fallback gray color for unknown badge type', () => {
    render(<Badge>unknown_type</Badge>);
    const el = screen.getByText('unknown_type');
    expect(el.className).toContain('bg-gray-600');
    expect(el.className).toContain('text-white');
  });

  it('applies custom className', () => {
    render(<Badge className="extra-class">test</Badge>);
    const el = screen.getByText('test');
    expect(el.className).toContain('extra-class');
  });

  it('does not apply default color when custom color is provided', () => {
    render(<Badge color="#00ff00">promo</Badge>);
    const el = screen.getByText('promo');
    expect(el.className).not.toContain('bg-gradient-to-r');
  });
});
