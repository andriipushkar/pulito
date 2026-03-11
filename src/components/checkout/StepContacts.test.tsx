// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/components/ui/Input', () => ({
  default: ({ label, error, ...props }: any) => (
    <div>
      <label>{label}</label>
      <input aria-label={label} {...props} />
      {error && <span data-testid="input-error">{error}</span>}
    </div>
  ),
}));
vi.mock('@/components/ui/PhoneInput', () => ({
  default: ({ label, error, ...props }: any) => (
    <div>
      <label>{label}</label>
      <input aria-label={label} {...props} />
      {error && <span data-testid="phone-error">{error}</span>}
    </div>
  ),
  cleanPhone: (v: string) => v.replace(/\D/g, ''),
}));

import StepContacts from './StepContacts';

describe('StepContacts', () => {
  it('renders without crashing', () => {
    const { container } = render(<StepContacts data={{}} errors={{}} onChange={vi.fn()} />);
    expect(container).toBeTruthy();
  });










  it('shows errors from props', () => {
    render(
      <StepContacts
        data={{}}
        errors={{ contactName: 'Required', contactEmail: 'Invalid email' }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('renders data values in inputs', () => {
    render(
      <StepContacts
        data={{ contactName: 'John', contactPhone: '+380111', contactEmail: 'j@x.com', companyName: 'ACME', edrpou: '12345678' }}
        errors={{}}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+380111')).toBeInTheDocument();
    expect(screen.getByDisplayValue('j@x.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ACME')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12345678')).toBeInTheDocument();
  });

  it('calls onChange with contactName when name input changes', () => {
    const handleChange = vi.fn();
    const { container } = render(<StepContacts data={{}} errors={{}} onChange={handleChange} />);
    const input = container.querySelector('input[aria-label="contactName *"]')!;
    fireEvent.change(input, { target: { value: 'Alice' } });
    expect(handleChange).toHaveBeenCalledWith('contactName', 'Alice');
  });

  it('calls onChange with cleaned contactPhone when phone input changes', () => {
    const handleChange = vi.fn();
    const { container } = render(<StepContacts data={{}} errors={{}} onChange={handleChange} />);
    const input = container.querySelector('input[aria-label="contactPhone *"]')!;
    fireEvent.change(input, { target: { value: '+38(099)1234567' } });
    expect(handleChange).toHaveBeenCalledWith('contactPhone', '380991234567');
  });

  it('calls onChange with contactEmail when email input changes', () => {
    const handleChange = vi.fn();
    const { container } = render(<StepContacts data={{}} errors={{}} onChange={handleChange} />);
    const input = container.querySelector('input[aria-label="contactEmail *"]')!;
    fireEvent.change(input, { target: { value: 'a@b.com' } });
    expect(handleChange).toHaveBeenCalledWith('contactEmail', 'a@b.com');
  });

  it('calls onChange with companyName when company input changes', () => {
    const handleChange = vi.fn();
    const { container } = render(<StepContacts data={{}} errors={{}} onChange={handleChange} />);
    const input = container.querySelector('input[aria-label="companyName"]')!;
    fireEvent.change(input, { target: { value: 'NewCo' } });
    expect(handleChange).toHaveBeenCalledWith('companyName', 'NewCo');
  });

  it('calls onChange with edrpou when edrpou input changes', () => {
    const handleChange = vi.fn();
    const { container } = render(<StepContacts data={{}} errors={{}} onChange={handleChange} />);
    const input = container.querySelector('input[aria-label="edrpou"]')!;
    fireEvent.change(input, { target: { value: '99887766' } });
    expect(handleChange).toHaveBeenCalledWith('edrpou', '99887766');
  });

  it('shows phone error when provided', () => {
    render(<StepContacts data={{}} errors={{ contactPhone: 'Bad phone' }} onChange={vi.fn()} />);
    expect(screen.getByText('Bad phone')).toBeInTheDocument();
  });

  it('shows company section heading', () => {
    const { container } = render(<StepContacts data={{}} errors={{}} onChange={vi.fn()} />);
    expect(container.textContent).toContain('companySection');
  });

  it('renders heading text', () => {
    const { container } = render(<StepContacts data={{}} errors={{}} onChange={vi.fn()} />);
    const heading = container.querySelector('h2');
    expect(heading?.textContent).toBe('stepContacts');
  });

  it('shows company and edrpou errors', () => {
    render(
      <StepContacts data={{}} errors={{ companyName: 'CompErr', edrpou: 'EdErr' }} onChange={vi.fn()} />
    );
    expect(screen.getByText('CompErr')).toBeInTheDocument();
    expect(screen.getByText('EdErr')).toBeInTheDocument();
  });
});
