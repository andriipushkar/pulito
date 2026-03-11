// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: (props: any) => <div data-testid="bar" data-datakey={props.dataKey} data-fill={props.fill} />,
  XAxis: (props: any) => {
    // Call the tickFormatter to cover it
    if (props.tickFormatter) {
      props.tickFormatter('2024-01');
      props.tickFormatter('2024-12');
      props.tickFormatter('invalid');
    }
    return <div data-testid="xaxis" />;
  },
  YAxis: () => <div data-testid="yaxis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

import FinanceChart from './FinanceChart';

describe('FinanceChart', () => {
  it('renders empty state when data is empty', () => {
    const { container } = render(<FinanceChart data={[]} dataKey="amount" color="#3b82f6" />);
    expect(container.textContent).toContain('Немає даних для відображення');
  });

  it('renders chart when data is provided', () => {
    const data = [
      { month: '2024-01', amount: 100 },
      { month: '2024-02', amount: 200 },
    ];
    const { getByTestId } = render(<FinanceChart data={data} dataKey="amount" color="#3b82f6" />);
    expect(getByTestId('responsive-container')).toBeInTheDocument();
    expect(getByTestId('bar-chart')).toBeInTheDocument();
    expect(getByTestId('bar')).toBeInTheDocument();
    expect(getByTestId('bar').getAttribute('data-datakey')).toBe('amount');
    expect(getByTestId('bar').getAttribute('data-fill')).toBe('#3b82f6');
    expect(getByTestId('xaxis')).toBeInTheDocument();
    expect(getByTestId('yaxis')).toBeInTheDocument();
    expect(getByTestId('grid')).toBeInTheDocument();
    expect(getByTestId('tooltip')).toBeInTheDocument();
  });


});
