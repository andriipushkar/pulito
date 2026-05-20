'use client';

import { useEffect, useState } from 'react';

interface WalletAvailability {
  applePay: boolean;
  googlePay: boolean;
  ready: boolean;
}

interface ApplePaySessionStatic {
  canMakePayments?: () => boolean;
}

declare global {
  interface Window {
    ApplePaySession?: ApplePaySessionStatic;
  }
}

export function useWalletAvailability(): WalletAvailability {
  const [state, setState] = useState<WalletAvailability>({
    applePay: false,
    googlePay: false,
    ready: false,
  });

  useEffect(() => {
    let cancelled = false;

    const applePay = !!window.ApplePaySession?.canMakePayments?.();

    const detectGooglePay = async (): Promise<boolean> => {
      if (typeof window.PaymentRequest === 'undefined') return false;
      try {
        const pr = new PaymentRequest(
          [
            {
              supportedMethods: 'https://google.com/pay',
              data: {
                environment: 'TEST',
                apiVersion: 2,
                apiVersionMinor: 0,
                allowedPaymentMethods: [
                  {
                    type: 'CARD',
                    parameters: {
                      allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
                      allowedCardNetworks: ['MASTERCARD', 'VISA'],
                    },
                  },
                ],
              },
            },
          ],
          { total: { label: 'probe', amount: { currency: 'UAH', value: '0.01' } } },
        );
        return await pr.canMakePayment();
      } catch {
        return false;
      }
    };

    detectGooglePay().then((googlePay) => {
      if (!cancelled) setState({ applePay, googlePay, ready: true });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
