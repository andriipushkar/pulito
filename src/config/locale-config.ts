export const LOCALE_CONFIG = {
  uk: {
    currency: 'UAH',
    currencySymbol: '₴',
    paymentMethods: ['liqpay', 'monobank', 'wayforpay', 'cod'],
  },
  en: {
    currency: 'UAH',
    currencySymbol: '₴',
    paymentMethods: ['liqpay', 'monobank', 'wayforpay', 'cod'],
  },
  pl: {
    currency: 'PLN',
    currencySymbol: 'zł',
    paymentMethods: ['przelewy24', 'blik', 'cod'],
  },
  ro: {
    currency: 'RON',
    currencySymbol: 'lei',
    paymentMethods: ['card', 'bank_transfer', 'cod'],
  },
} as const;

export type SupportedLocale = keyof typeof LOCALE_CONFIG;
