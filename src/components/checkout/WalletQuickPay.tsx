'use client';

interface WalletQuickPayProps {
  applePay: boolean;
  googlePay: boolean;
  selectedProvider?: string;
  onSelect: (provider: 'apple_pay' | 'google_pay') => void;
}

export default function WalletQuickPay({
  applePay,
  googlePay,
  selectedProvider,
  onSelect,
}: WalletQuickPayProps) {
  return (
    <div className="space-y-2">
      {applePay && (
        <button
          type="button"
          aria-pressed={selectedProvider === 'apple_pay'}
          aria-label="Оплатити через Apple Pay"
          onClick={() => onSelect('apple_pay')}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] font-medium transition-all ${
            selectedProvider === 'apple_pay'
              ? 'bg-black text-white ring-2 ring-black ring-offset-2'
              : 'bg-black text-white hover:bg-black/90'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.5 12.5c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.8.8 3.1.8c1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.7-1-2.7-4zm-2.4-7.4c.6-.8 1.1-1.9 1-3-.9.1-2.1.7-2.7 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.1-.5 2.7-1.3z" />
          </svg>
          <span>Pay</span>
        </button>
      )}
      {googlePay && (
        <button
          type="button"
          aria-pressed={selectedProvider === 'google_pay'}
          aria-label="Оплатити через Google Pay"
          onClick={() => onSelect('google_pay')}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] font-medium transition-all ${
            selectedProvider === 'google_pay'
              ? 'bg-white text-black ring-2 ring-black ring-offset-2'
              : 'bg-white text-black hover:bg-gray-50'
          } border border-[var(--color-border)]`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.18 12.21c0-.78-.06-1.36-.2-1.96H12.16v3.55h5.76c-.11.9-.74 2.27-2.13 3.19l-.02.13 3.1 2.41.21.02c1.97-1.82 3.1-4.5 3.1-7.34z"
            />
            <path
              fill="#34A853"
              d="M12.16 22.5c2.81 0 5.17-.93 6.9-2.52l-3.29-2.55c-.88.61-2.06 1.04-3.61 1.04-2.76 0-5.1-1.82-5.94-4.34l-.12.01-3.22 2.5-.04.12c1.72 3.42 5.25 5.74 9.32 5.74z"
            />
            <path
              fill="#FBBC04"
              d="M6.22 14.13c-.22-.66-.35-1.36-.35-2.09 0-.73.13-1.43.34-2.09l-.01-.14-3.26-2.54-.11.05a10.5 10.5 0 000 9.43l3.39-2.62z"
            />
            <path
              fill="#EA4335"
              d="M12.16 5.6c1.96 0 3.28.85 4.04 1.56l2.95-2.88C17.32 2.6 14.97 1.5 12.16 1.5c-4.07 0-7.6 2.32-9.32 5.74l3.38 2.62c.85-2.52 3.18-4.34 5.94-4.34z"
            />
          </svg>
          <span>Pay</span>
        </button>
      )}
    </div>
  );
}
