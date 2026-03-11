// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import PageHeader from './PageHeader';

describe('PageHeader', () => {
  it('renders title and icon', () => {
    render(<PageHeader icon={<span>IC</span>} title="My Title" />);
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('IC')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<PageHeader icon={<span>IC</span>} title="Title" subtitle="Sub text" />);
    expect(screen.getByText('Sub text')).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    const { container } = render(<PageHeader icon={<span>IC</span>} title="Title" />);
    expect(container.querySelector('p')).not.toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(<PageHeader icon={<span>IC</span>} title="Title" actions={<button>Action</button>} />);
    expect(screen.getByText('Action')).toBeInTheDocument();
  });


  it('renders badge when provided', () => {
    render(<PageHeader icon={<span>IC</span>} title="Title" badge={<span>NEW</span>} />);
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });


  it('renders title as ReactNode', () => {
    render(<PageHeader icon={<span>IC</span>} title={<span data-testid="custom-title">Custom</span>} />);
    expect(screen.getByTestId('custom-title')).toBeInTheDocument();
  });

  it('renders all optional props together', () => {
    render(
      <PageHeader
        icon={<span>IC</span>}
        title="Full Header"
        subtitle="With everything"
        actions={<button>Edit</button>}
        badge={<span>PRO</span>}
      />
    );
    expect(screen.getByText('Full Header')).toBeInTheDocument();
    expect(screen.getByText('With everything')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('PRO')).toBeInTheDocument();
  });
});
