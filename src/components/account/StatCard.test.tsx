// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import StatCard from './StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Orders" value={42} />);
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<StatCard label="Revenue" value="1,000 ₴" />);
    expect(screen.getByText('1,000 ₴')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<StatCard label="Orders" value={42} subtitle="last 30 days" />);
    expect(screen.getByText('last 30 days')).toBeInTheDocument();
  });


  it('renders icon when provided', () => {
    render(<StatCard label="Orders" value={42} icon={<span data-testid="stat-icon">IC</span>} />);
    expect(screen.getByTestId('stat-icon')).toBeInTheDocument();
  });

  it('does not render icon container when icon not provided', () => {
    const { container } = render(<StatCard label="Orders" value={42} />);
    expect(container.querySelector('.h-9.w-9')).not.toBeInTheDocument();
  });

  it('renders positive trend', () => {
    render(<StatCard label="Revenue" value="1000" trend={{ value: '+10%', positive: true }} />);
    expect(screen.getByText(/\+10%/)).toBeInTheDocument();
    expect(screen.getByText(/↑/)).toBeInTheDocument();
  });

  it('renders negative trend', () => {
    render(<StatCard label="Revenue" value="1000" trend={{ value: '-5%', positive: false }} />);
    expect(screen.getByText(/-5%/)).toBeInTheDocument();
    expect(screen.getByText(/↓/)).toBeInTheDocument();
  });



  it('does not render trend when not provided', () => {
    render(<StatCard label="Orders" value={42} />);
    expect(screen.queryByText('↑')).not.toBeInTheDocument();
    expect(screen.queryByText('↓')).not.toBeInTheDocument();
  });

  it('applies custom iconBg', () => {
    const { container } = render(
      <StatCard label="Orders" value={42} icon={<span>IC</span>} iconBg="bg-blue-100 text-blue-600" />
    );
    const iconContainer = container.querySelector('.h-9.w-9');
    expect(iconContainer?.className).toContain('bg-blue-100');
    expect(iconContainer?.className).toContain('text-blue-600');
  });

  it('uses default iconBg when not specified', () => {
    const { container } = render(<StatCard label="Orders" value={42} icon={<span>IC</span>} />);
    const iconContainer = container.querySelector('.h-9.w-9');
    expect(iconContainer?.className).toContain('bg-[var(--color-bg-secondary)]');
  });

  it('renders all props together', () => {
    render(
      <StatCard
        label="Total Revenue"
        value="50,000 ₴"
        subtitle="All time"
        icon={<span>$</span>}
        iconBg="bg-green-100"
        trend={{ value: '+15%', positive: true }}
      />
    );
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('50,000 ₴')).toBeInTheDocument();
    expect(screen.getByText('All time')).toBeInTheDocument();
    expect(screen.getByText('$')).toBeInTheDocument();
    expect(screen.getByText(/\+15%/)).toBeInTheDocument();
  });
});
