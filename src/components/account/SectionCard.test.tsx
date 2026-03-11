// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import SectionCard from './SectionCard';

describe('SectionCard', () => {
  it('renders children', () => {
    render(<SectionCard>Content here</SectionCard>);
    expect(screen.getByText('Content here')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<SectionCard title="Section Title">Body</SectionCard>);
    expect(screen.getByText('Section Title')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<SectionCard icon={<span data-testid="icon">IC</span>}>Body</SectionCard>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(<SectionCard actions={<button>Action</button>}>Body</SectionCard>);
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('does not render header when no icon, title, or actions', () => {
    const { container } = render(<SectionCard>Body only</SectionCard>);
    // No border-b header div
    expect(container.querySelector('.border-b')).not.toBeInTheDocument();
  });

  it('renders header when only icon provided', () => {
    const { container } = render(<SectionCard icon={<span>IC</span>}>Body</SectionCard>);
    expect(container.querySelector('.border-b')).toBeInTheDocument();
  });

  it('renders header when only actions provided', () => {
    render(<SectionCard actions={<button>Act</button>}>Body</SectionCard>);
    expect(screen.getByText('Act')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<SectionCard className="custom-class">Body</SectionCard>);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('wraps children in padding div by default', () => {
    const { container } = render(<SectionCard>Padded</SectionCard>);
    expect(container.querySelector('.p-5')).toBeInTheDocument();
  });

  it('does not wrap children in padding when noPadding is true', () => {
    const { container } = render(<SectionCard noPadding>No pad</SectionCard>);
    expect(container.querySelector('.p-5')).not.toBeInTheDocument();
  });


});
