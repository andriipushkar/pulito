export interface MarketplaceConfig {
  enabled: boolean;
  [key: string]: string | boolean;
}

export interface ProductForMarketplace {
  id: number;
  name: string;
  code: string;
  priceRetail: number;
  quantity: number;
  imagePath: string | null;
  isActive: boolean;
  category: { name: string } | null;
}

// UI strings (descriptions, docs labels, field labels/placeholders/help) live
// in the `admin.marketplacesShared` i18n namespace. Values below are translation
// KEYS, resolved by consumers via useTranslations('admin.marketplacesShared').
export const MARKETPLACES = [
  {
    key: 'olx',
    name: 'OLX',
    icon: '🟢',
    color: '#002f34',
    description: 'desc_olx',
    docsUrl: 'https://developer.olx.ua/',
    docsLabel: 'docs_olx',
    supports: { products: true, stock: true, orders: true },
    fields: [
      {
        key: 'clientId',
        label: 'label_clientId',
        placeholder: 'ph_clientId',
        sensitive: false,
        optional: false,
        help: 'help_clientId',
      },
      {
        key: 'accessToken',
        label: 'label_accessToken',
        placeholder: 'ph_accessToken',
        sensitive: true,
        optional: false,
        help: 'help_accessToken',
      },
      {
        key: 'defaultCategoryId',
        label: 'label_defaultCategoryId',
        placeholder: 'ph_defaultCategoryId',
        sensitive: false,
        optional: true,
        help: 'help_defaultCategoryId',
      },
      {
        key: 'cityId',
        label: 'label_cityId',
        placeholder: 'ph_cityId',
        sensitive: false,
        optional: true,
        help: 'help_cityId',
      },
      {
        key: 'contactName',
        label: 'label_contactName',
        placeholder: 'ph_contactName',
        sensitive: false,
        optional: true,
      },
      {
        key: 'contactPhone',
        label: 'label_contactPhone',
        placeholder: 'ph_contactPhone',
        sensitive: false,
        optional: true,
      },
      {
        key: 'webhookSecret',
        label: 'label_webhookSecret',
        placeholder: 'ph_webhookSecret',
        sensitive: true,
        optional: true,
        help: 'help_webhookSecret_olx',
      },
      {
        key: 'priceMarkupPercent',
        label: 'label_priceMarkupPercent',
        placeholder: 'ph_priceMarkupPercent',
        sensitive: false,
        optional: true,
        help: 'help_priceMarkupPercent',
      },
      {
        key: 'stockAllocationPercent',
        label: 'label_stockAllocationPercent',
        placeholder: 'ph_stockAllocationPercent',
        sensitive: false,
        optional: true,
        help: 'help_stockAllocationPercent',
      },
      {
        key: 'commissionPercent',
        label: 'label_commissionPercent',
        placeholder: 'ph_commissionPercent',
        sensitive: false,
        optional: true,
        help: 'help_commissionPercent',
      },
      {
        key: 'clientSecret',
        label: 'label_clientSecret',
        placeholder: 'ph_clientSecret',
        sensitive: true,
        optional: true,
        help: 'help_clientSecret',
      },
      {
        key: 'refreshToken',
        label: 'label_refreshToken',
        placeholder: 'ph_refreshToken',
        sensitive: true,
        optional: true,
        help: 'help_refreshToken',
      },
    ],
  },
  {
    key: 'rozetka',
    name: 'Rozetka',
    icon: '🟩',
    color: '#00a046',
    description: 'desc_rozetka',
    docsUrl: 'https://seller.rozetka.com.ua/',
    docsLabel: 'docs_rozetka',
    supports: { products: true, stock: true, orders: true },
    fields: [
      {
        key: 'apiKey',
        label: 'label_apiKey',
        placeholder: 'ph_apiKey_rozetka',
        sensitive: true,
        optional: false,
        help: 'help_apiKey_rozetka',
      },
      {
        key: 'sellerId',
        label: 'label_sellerId',
        placeholder: 'ph_sellerId',
        sensitive: false,
        optional: false,
        help: 'help_sellerId_rozetka',
      },
      {
        key: 'webhookSecret',
        label: 'label_webhookSecret',
        placeholder: 'ph_webhookSecret',
        sensitive: true,
        optional: true,
        help: 'help_webhookSecret_rozetka',
      },
      {
        key: 'priceMarkupPercent',
        label: 'label_priceMarkupPercent',
        placeholder: 'ph_priceMarkupPercent',
        sensitive: false,
        optional: true,
        help: 'help_priceMarkupPercent',
      },
      {
        key: 'stockAllocationPercent',
        label: 'label_stockAllocationPercent',
        placeholder: 'ph_stockAllocationPercent',
        sensitive: false,
        optional: true,
        help: 'help_stockAllocationPercent',
      },
      {
        key: 'commissionPercent',
        label: 'label_commissionPercent',
        placeholder: 'ph_commissionPercent',
        sensitive: false,
        optional: true,
        help: 'help_commissionPercent',
      },
    ],
  },
  {
    key: 'prom',
    name: 'Prom.ua',
    icon: '🔵',
    color: '#2b5797',
    description: 'desc_prom',
    docsUrl: 'https://my.prom.ua/cabinet/access-api',
    docsLabel: 'docs_prom',
    supports: { products: true, stock: true, orders: true },
    fields: [
      {
        key: 'apiToken',
        label: 'label_apiToken',
        placeholder: 'ph_apiToken',
        sensitive: true,
        optional: false,
        help: 'help_apiToken_prom',
      },
      {
        key: 'webhookSecret',
        label: 'label_webhookSecret',
        placeholder: 'ph_webhookSecret',
        sensitive: true,
        optional: true,
        help: 'help_webhookSecret_prom',
      },
      {
        key: 'priceMarkupPercent',
        label: 'label_priceMarkupPercent',
        placeholder: 'ph_priceMarkupPercent',
        sensitive: false,
        optional: true,
        help: 'help_priceMarkupPercent',
      },
      {
        key: 'stockAllocationPercent',
        label: 'label_stockAllocationPercent',
        placeholder: 'ph_stockAllocationPercent',
        sensitive: false,
        optional: true,
        help: 'help_stockAllocationPercent',
      },
      {
        key: 'commissionPercent',
        label: 'label_commissionPercent',
        placeholder: 'ph_commissionPercent',
        sensitive: false,
        optional: true,
        help: 'help_commissionPercent',
      },
    ],
  },
  {
    key: 'epicentrk',
    name: 'Epicentr K',
    icon: '🟠',
    color: '#f57c00',
    description: 'desc_epicentrk',
    docsUrl: 'https://marketplace.epicentrk.ua/',
    docsLabel: 'docs_epicentrk',
    supports: { products: true, stock: true, orders: true },
    fields: [
      {
        key: 'apiKey',
        label: 'label_apiKey',
        placeholder: 'ph_apiKey_epicentrk',
        sensitive: true,
        optional: false,
        help: 'help_apiKey_epicentrk',
      },
      {
        key: 'sellerId',
        label: 'label_sellerId',
        placeholder: 'ph_sellerId',
        sensitive: false,
        optional: false,
        help: 'help_sellerId_epicentrk',
      },
      {
        key: 'webhookSecret',
        label: 'label_webhookSecret',
        placeholder: 'ph_webhookSecret',
        sensitive: true,
        optional: true,
        help: 'help_webhookSecret_epicentrk',
      },
      {
        key: 'priceMarkupPercent',
        label: 'label_priceMarkupPercent',
        placeholder: 'ph_priceMarkupPercent',
        sensitive: false,
        optional: true,
        help: 'help_priceMarkupPercent',
      },
      {
        key: 'stockAllocationPercent',
        label: 'label_stockAllocationPercent',
        placeholder: 'ph_stockAllocationPercent',
        sensitive: false,
        optional: true,
        help: 'help_stockAllocationPercent',
      },
      {
        key: 'commissionPercent',
        label: 'label_commissionPercent',
        placeholder: 'ph_commissionPercent',
        sensitive: false,
        optional: true,
        help: 'help_commissionPercent',
      },
    ],
  },
] as const;

// O(1) lookup map. Each MARKETPLACES.find(m => m.key === k) call inside JSX
// rendered O(N) per row, which adds up across history/products/analytics
// tables on big shops. Build the index once.
export const MARKETPLACE_BY_KEY: Record<string, (typeof MARKETPLACES)[number]> = Object.fromEntries(
  MARKETPLACES.map((m) => [m.key, m]),
);

export type TabKey = 'products' | 'history' | 'messages' | 'analytics' | 'settings';

export type HealthStatus = {
  status: 'ok' | 'error' | 'disabled' | 'unconfigured';
  checkedAt: string;
  latencyMs: number;
  accountName?: string;
  error?: string;
};

export type RateUsage = {
  windowMs: number;
  count: number;
  limit5min: number;
  percent: number;
  warning: boolean;
};

export type MarketplaceStatus = {
  platform: string;
  connected: boolean;
  publishedCount: number;
  lastSyncProducts: string | null;
  lastSyncStock: string | null;
  lastSyncOrders: string | null;
  health: HealthStatus | null;
  rateUsage: RateUsage | null;
};

export type SyncType = 'products' | 'stock' | 'orders';
export type SyncInterval = 'off' | '1h' | '6h' | '12h' | '24h';
export type AutoSyncMap = Record<string, Partial<Record<SyncType, SyncInterval>>>;

export function formatRelative(
  t: (key: string, values?: Record<string, string | number>) => string,
  iso: string | null | undefined,
): string {
  if (!iso) return t('relNever');
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return t('relJustNow');
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return t('relSec', { n: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return t('relMin', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('relHour', { n: hr });
  const day = Math.floor(hr / 24);
  return t('relDay', { n: day });
}
