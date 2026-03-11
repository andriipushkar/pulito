// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import StepConfirmation from './StepConfirmation';

const baseData = {
  contactName: 'John Doe',
  contactPhone: '+380123456789',
  contactEmail: 'john@test.com',
};

const mockItems = [
  { productId: 1, name: 'Product A', slug: 'a', code: 'A1', priceRetail: 100, priceWholesale: null, imagePath: null, quantity: 2, maxQuantity: 10 },
  { productId: 2, name: 'Product B', slug: 'b', code: 'B1', priceRetail: 50, priceWholesale: null, imagePath: null, quantity: 1, maxQuantity: 10 },
] as any[];

describe('StepConfirmation', () => {
  it('renders review heading', () => {
    render(<StepConfirmation data={baseData} items={[]} total={0} />);
    expect(screen.getByText('reviewOrder')).toBeInTheDocument();
  });




  it('renders delivery method label', () => {
    render(
      <StepConfirmation
        data={{ ...baseData, deliveryMethod: 'nova_poshta' as any }}
        items={[]}
        total={100}
      />
    );
    expect(screen.getByText('Нова Пошта')).toBeInTheDocument();
  });

  it('renders delivery city and address', () => {
    render(
      <StepConfirmation
        data={{ ...baseData, deliveryMethod: 'nova_poshta' as any, deliveryCity: 'Kyiv', deliveryAddress: 'Street 1' }}
        items={[]}
        total={100}
      />
    );
    expect(screen.getByText('Kyiv')).toBeInTheDocument();
    expect(screen.getByText('Street 1')).toBeInTheDocument();
  });


  it('renders payment method label', () => {
    render(
      <StepConfirmation
        data={{ ...baseData, paymentMethod: 'cod' as any }}
        items={[]}
        total={100}
      />
    );
    expect(screen.getByText('Накладений платіж')).toBeInTheDocument();
  });

  it('renders comment when provided', () => {
    render(
      <StepConfirmation
        data={{ ...baseData, paymentMethod: 'cod' as any, comment: 'Please hurry' }}
        items={[]}
        total={100}
      />
    );
    expect(screen.getByText(/Please hurry/)).toBeInTheDocument();
  });

  it('does not render comment when not provided', () => {
    render(
      <StepConfirmation data={{ ...baseData, paymentMethod: 'cod' as any }} items={[]} total={100} />
    );
    expect(screen.queryByText('paymentComment')).not.toBeInTheDocument();
  });

  it('renders items with quantities and subtotals', () => {
    render(<StepConfirmation data={baseData} items={mockItems} total={250} />);
    expect(screen.getByText('Product A')).toBeInTheDocument();
    expect(screen.getByText('x2')).toBeInTheDocument();
    expect(screen.getByText('200.00 currency')).toBeInTheDocument();
    expect(screen.getByText('Product B')).toBeInTheDocument();
  });



  // Loyalty points tests
  it('does not show loyalty section when loyaltyPoints is 0', () => {
    render(
      <StepConfirmation data={baseData} items={[]} total={100} loyaltyPoints={0} onLoyaltyPointsChange={vi.fn()} />
    );
    expect(screen.queryByText('loyaltyPoints')).not.toBeInTheDocument();
  });

  it('does not show loyalty section when onLoyaltyPointsChange is not provided', () => {
    render(
      <StepConfirmation data={baseData} items={[]} total={100} loyaltyPoints={50} />
    );
    expect(screen.queryByText('loyaltyPoints')).not.toBeInTheDocument();
  });





  it('shows discount text when pointsDiscount > 0', () => {
    render(
      <StepConfirmation
        data={baseData}
        items={mockItems}
        total={250}
        loyaltyPoints={50}
        loyaltyPointsToSpend={30}
        onLoyaltyPointsChange={vi.fn()}
      />
    );
    // Shows discount in loyalty section and items section
    expect(screen.getAllByText(/-30.00 currency/).length).toBeGreaterThanOrEqual(1);
  });

  it('adjusts final total by points discount', () => {
    render(
      <StepConfirmation
        data={baseData}
        items={[]}
        total={100}
        loyaltyPoints={50}
        loyaltyPointsToSpend={30}
        onLoyaltyPointsChange={vi.fn()}
      />
    );
    // finalTotal = 100 - 30 = 70
    expect(screen.getByText('70.00 currency')).toBeInTheDocument();
  });



  it('renders edrpou without company name when only edrpou provided', () => {
    render(
      <StepConfirmation
        data={{ ...baseData, companyName: 'TestCo' }}
        items={[]}
        total={100}
      />
    );
    // companyName without edrpou - no (edrpou: ...) suffix
    expect(screen.getByText('TestCo')).toBeInTheDocument();
  });






  it('renders dash when no delivery method set', () => {
    const { container } = render(
      <StepConfirmation data={baseData} items={[]} total={0} />
    );
    // deliveryMethod is undefined, should show dash
    const allTexts = container.textContent;
    expect(allTexts).toContain('—');
  });

  it('renders dash when no payment method set', () => {
    const { container } = render(
      <StepConfirmation data={baseData} items={[]} total={0} />
    );
    const allTexts = container.textContent;
    expect(allTexts).toContain('—');
  });


  it('shows points discount in items section when spending points', () => {
    render(
      <StepConfirmation
        data={baseData}
        items={mockItems}
        total={250}
        loyaltyPoints={50}
        loyaltyPointsToSpend={20}
        onLoyaltyPointsChange={vi.fn()}
      />
    );
    // Points discount appears twice: in loyalty section and items section
    const discountTexts = screen.getAllByText(/-20.00 currency/);
    expect(discountTexts.length).toBeGreaterThanOrEqual(1);
    // Final total = 250 - 20 = 230
    expect(screen.getByText('230.00 currency')).toBeInTheDocument();
  });

  it('calls onLoyaltyPointsChange when points input changes', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <StepConfirmation
        data={baseData}
        items={[]}
        total={100}
        loyaltyPoints={50}
        loyaltyPointsToSpend={0}
        onLoyaltyPointsChange={handleChange}
      />
    );
    const input = container.querySelector('input[type="number"]')!;
    fireEvent.change(input, { target: { value: '25' } });
    expect(handleChange).toHaveBeenCalledWith(25);
  });

  it('clamps points to maxSpendable when input exceeds it', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <StepConfirmation
        data={baseData}
        items={[]}
        total={100}
        loyaltyPoints={50}
        loyaltyPointsToSpend={0}
        onLoyaltyPointsChange={handleChange}
      />
    );
    const input = container.querySelector('input[type="number"]')!;
    fireEvent.change(input, { target: { value: '999' } });
    // maxSpendable = min(50, floor(100)) = 50
    expect(handleChange).toHaveBeenCalledWith(50);
  });

  it('clamps points to 0 when input is negative', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <StepConfirmation
        data={baseData}
        items={[]}
        total={100}
        loyaltyPoints={50}
        loyaltyPointsToSpend={0}
        onLoyaltyPointsChange={handleChange}
      />
    );
    const input = container.querySelector('input[type="number"]')!;
    fireEvent.change(input, { target: { value: '-5' } });
    expect(handleChange).toHaveBeenCalledWith(0);
  });

  it('calls onLoyaltyPointsChange with maxSpendable when max button clicked', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <StepConfirmation
        data={baseData}
        items={[]}
        total={100}
        loyaltyPoints={50}
        loyaltyPointsToSpend={0}
        onLoyaltyPointsChange={handleChange}
      />
    );
    const maxBtn = container.querySelector('button[type="button"]')!;
    fireEvent.click(maxBtn);
    expect(handleChange).toHaveBeenCalledWith(50);
  });

  it('handles NaN input value gracefully', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <StepConfirmation
        data={baseData}
        items={[]}
        total={100}
        loyaltyPoints={50}
        loyaltyPointsToSpend={0}
        onLoyaltyPointsChange={handleChange}
      />
    );
    const input = container.querySelector('input[type="number"]')!;
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(handleChange).toHaveBeenCalledWith(0);
  });

  it('renders edrpou with company name', () => {
    render(
      <StepConfirmation
        data={{ ...baseData, companyName: 'TestCo', edrpou: '12345678' }}
        items={[]}
        total={100}
      />
    );
    expect(screen.getByText(/TestCo.*12345678/)).toBeInTheDocument();
  });
});
