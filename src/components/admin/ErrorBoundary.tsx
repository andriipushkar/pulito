'use client';

import { Component, type ReactNode } from 'react';
import Button from '@/components/ui/Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AdminErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <svg className="h-6 w-6 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {this.props.fallbackTitle || 'Щось пішло не так'}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {this.state.error?.message || 'Невідома помилка'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={this.handleRetry}>Спробувати знову</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Перезавантажити сторінку
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
