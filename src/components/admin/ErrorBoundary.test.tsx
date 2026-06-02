// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Local next-intl mock: resolve real Ukrainian copy (with ICU) from messages so
// translated-text assertions match production, overriding the global passthrough.
vi.mock('next-intl', async (importActual) => {
  const actual = await importActual<any>();
  const uk = (await import('@/messages/uk.json')).default;
  return {
    ...actual,
    useTranslations: (ns?: string) =>
      actual.createTranslator({ locale: 'uk', messages: uk, namespace: ns }),
    useLocale: () => 'uk',
    useFormatter: () => actual.createFormatter({ locale: 'uk' }),
  };
});

vi.mock('@/components/ui/Button', () => ({
  default: ({ children, onClick, variant, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} {...props}>
      {children}
    </button>
  ),
}));

import AdminErrorBoundary from './ErrorBoundary';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
});

function ThrowingChild(): never {
  throw new Error('Test error message');
}

describe('AdminErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <AdminErrorBoundary>
        <div>Normal content</div>
      </AdminErrorBoundary>,
    );
    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('shows fallback UI when child throws', () => {
    render(
      <AdminErrorBoundary>
        <ThrowingChild />
      </AdminErrorBoundary>,
    );
    expect(screen.getByText('Щось пішло не так')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('shows custom fallbackTitle when provided', () => {
    render(
      <AdminErrorBoundary fallbackTitle="Custom error title">
        <ThrowingChild />
      </AdminErrorBoundary>,
    );
    expect(screen.getByText('Custom error title')).toBeInTheDocument();
  });

  it('renders retry and reload buttons', () => {
    render(
      <AdminErrorBoundary>
        <ThrowingChild />
      </AdminErrorBoundary>,
    );
    expect(screen.getByText('Спробувати знову')).toBeInTheDocument();
    expect(screen.getByText('Перезавантажити сторінку')).toBeInTheDocument();
  });

  it('retry button resets error state', () => {
    render(
      <AdminErrorBoundary>
        <ThrowingChild />
      </AdminErrorBoundary>,
    );
    // Clicking retry resets, but child throws again immediately
    fireEvent.click(screen.getByText('Спробувати знову'));
    // Error boundary catches it again
    expect(screen.getByText('Щось пішло не так')).toBeInTheDocument();
  });

  it('shows "Невідома помилка" when error has no message', () => {
    function ThrowEmpty(): never {
      throw Object.assign(new Error(), { message: '' });
    }
    render(
      <AdminErrorBoundary>
        <ThrowEmpty />
      </AdminErrorBoundary>,
    );
    expect(screen.getByText('Невідома помилка')).toBeInTheDocument();
  });
});
