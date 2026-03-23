// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CalculatorResults from './CalculatorResults';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockProduct = {
  productId: 1,
  name: 'Засіб для миття',
  slug: 'zasib-dlya-myttya',
  imagePath: null,
  priceRetail: 120,
  quantityPerMonth: 2,
  totalCost: 240,
  category: 'Миття посуду',
};

const mockRoomResults = [
  {
    roomType: 'kitchen',
    roomLabel: 'Кухня',
    count: 1,
    area: 12,
    products: [mockProduct],
    monthlyCost: 240,
  },
  {
    roomType: 'bathroom',
    roomLabel: 'Ванна кімната',
    count: 2,
    area: 6,
    products: [
      {
        ...mockProduct,
        productId: 2,
        name: 'Засіб для ванної',
        slug: 'zasib-dlya-vannoyi',
        totalCost: 180,
        category: 'Ванна',
      },
    ],
    monthlyCost: 180,
  },
];

describe('CalculatorResults', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders empty state when no results', () => {
    render(
      <CalculatorResults
        totalMonthly={0}
        onAddToCart={vi.fn()}
      />
    );

    expect(screen.getByText(/не вдалося підібрати товари/)).toBeInTheDocument();
  });

  it('renders room breakdown with per-room costs', () => {
    render(
      <CalculatorResults
        roomResults={mockRoomResults}
        totalMonthly={420}
        onAddToCart={vi.fn()}
        onAddAllToCart={vi.fn()}
      />
    );

    expect(screen.getByTestId('room-result-kitchen')).toBeInTheDocument();
    expect(screen.getByTestId('room-result-bathroom')).toBeInTheDocument();
    expect(screen.getByText('Кухня')).toBeInTheDocument();
    expect(screen.getByText('Ванна кімната')).toBeInTheDocument();
  });

  it('shows total monthly cost', () => {
    render(
      <CalculatorResults
        roomResults={mockRoomResults}
        totalMonthly={420}
        onAddToCart={vi.fn()}
      />
    );

    const totalCost = screen.getByTestId('total-cost');
    expect(totalCost).toHaveTextContent('420.00 грн');
  });

  it('shows add-all-to-cart button when handler provided', () => {
    render(
      <CalculatorResults
        roomResults={mockRoomResults}
        totalMonthly={420}
        onAddToCart={vi.fn()}
        onAddAllToCart={vi.fn()}
      />
    );

    expect(screen.getByTestId('add-all-to-cart')).toBeInTheDocument();
    expect(screen.getByTestId('add-all-to-cart')).toHaveTextContent('Додати все в кошик');
  });

  it('shows download PDF button', () => {
    render(
      <CalculatorResults
        roomResults={mockRoomResults}
        totalMonthly={420}
        onAddToCart={vi.fn()}
      />
    );

    expect(screen.getByTestId('download-pdf')).toHaveTextContent('Завантажити PDF');
  });

  it('renders legacy recommendations when no room results', () => {
    render(
      <CalculatorResults
        recommendations={[mockProduct]}
        totalMonthly={240}
        totalQuarterly={720}
        onAddToCart={vi.fn()}
      />
    );

    expect(screen.getByText('Засіб для миття')).toBeInTheDocument();
    expect(screen.getByTestId('total-cost')).toHaveTextContent('240.00 грн');
  });
});
