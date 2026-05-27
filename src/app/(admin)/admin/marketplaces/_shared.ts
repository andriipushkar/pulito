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

export const MARKETPLACES = [
  {
    key: 'olx',
    name: 'OLX',
    icon: '🟢',
    color: '#002f34',
    description: 'Публікація оголошень на OLX.ua',
    docsUrl: 'https://developer.olx.ua/',
    docsLabel: 'Як отримати OLX API ключі',
    supports: { products: true, stock: true, orders: true },
    fields: [
      {
        key: 'clientId',
        label: 'Client ID',
        placeholder: 'OLX API Client ID',
        sensitive: false,
        optional: false,
        help: 'Створіть OLX-додаток у developer.olx.ua → Manage Apps. Client ID показано на сторінці додатка.',
      },
      {
        key: 'accessToken',
        label: 'Access Token',
        placeholder: 'OLX API Access Token',
        sensitive: true,
        optional: false,
        help: 'Згенеруйте через OAuth 2.0 авторизацію OLX. Токен діє до 30 днів — оновіть при помилці 401.',
      },
      {
        key: 'defaultCategoryId',
        label: 'Категорія за замовч.',
        placeholder: '1430',
        sensitive: false,
        optional: true,
        help: 'ID категорії OLX за замовчуванням для нових оголошень. Список: https://developer.olx.ua/api/data/category',
      },
      {
        key: 'cityId',
        label: 'Місто (ID)',
        placeholder: '1',
        sensitive: false,
        optional: true,
        help: 'ID міста OLX (1 = Київ). Список міст у документації OLX.',
      },
      {
        key: 'contactName',
        label: "Ім'я контакту",
        placeholder: 'Pulito Trade',
        sensitive: false,
        optional: true,
      },
      {
        key: 'contactPhone',
        label: 'Телефон',
        placeholder: '+380501234567',
        sensitive: false,
        optional: true,
      },
      {
        key: 'webhookSecret',
        label: 'Webhook Secret',
        placeholder: 'Секрет для перевірки підпису webhook',
        sensitive: true,
        optional: true,
        help: 'Секрет від OLX для перевірки HMAC-підпису webhook. У production без нього всі POST блокуються (503) — інакше зловмисник може надсилати фейкові події. Не optional на проді.',
      },
      {
        key: 'priceMarkupPercent',
        label: 'Націнка, %',
        placeholder: '0',
        sensitive: false,
        optional: true,
        help: "Націнка до базової ціни (можна від'ємну). Наприклад, 5 = +5%, -3 = -3%. Діапазон ±50%.",
      },
      {
        key: 'stockAllocationPercent',
        label: 'Алокація залишку, %',
        placeholder: '100',
        sensitive: false,
        optional: true,
        help: 'Який % загального залишку показувати на цьому маркетплейсі. 100 = весь залишок, 30 = 30%. Корисно щоб ділити запас між маркетплейсами і уникнути overselling.',
      },
      {
        key: 'commissionPercent',
        label: 'Комісія маркетплейсу, %',
        placeholder: '15',
        sensitive: false,
        optional: true,
        help: 'Середня комісія цього маркетплейсу з продажу (5-25%). Використовується для розрахунку чистого прибутку в Аналітиці. Залиште 0, якщо не знаєте — буде показано лише виручку.',
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        placeholder: 'OLX OAuth Client Secret',
        sensitive: true,
        optional: true,
        help: 'Потрібен для оновлення Access Token через refresh_token. Знайти в OLX developer console поряд з Client ID.',
      },
      {
        key: 'refreshToken',
        label: 'Refresh Token',
        placeholder: 'OLX OAuth Refresh Token',
        sensitive: true,
        optional: true,
        help: 'Видається разом з access_token при авторизації. Використовується для авто-оновлення expired токенів.',
      },
    ],
  },
  {
    key: 'rozetka',
    name: 'Rozetka',
    icon: '🟩',
    color: '#00a046',
    description: 'Публікація товарів на Rozetka Marketplace',
    docsUrl: 'https://seller.rozetka.com.ua/',
    docsLabel: 'Кабінет продавця Rozetka',
    supports: { products: true, stock: true, orders: true },
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        placeholder: 'Rozetka Seller API Key',
        sensitive: true,
        optional: false,
        help: 'Кабінет продавця → Налаштування → API. Скопіюйте Token Seller API.',
      },
      {
        key: 'sellerId',
        label: 'Seller ID',
        placeholder: '12345',
        sensitive: false,
        optional: false,
        help: 'Числовий ID магазину з кабінету продавця (праворуч від назви магазину).',
      },
      {
        key: 'webhookSecret',
        label: 'Webhook Secret',
        placeholder: 'Секрет для перевірки підпису webhook',
        sensitive: true,
        optional: true,
        help: 'Секрет з налаштувань webhook у кабінеті Rozetka для перевірки HMAC-підпису. У production без нього всі POST блокуються (503). Не optional на проді.',
      },
      {
        key: 'priceMarkupPercent',
        label: 'Націнка, %',
        placeholder: '0',
        sensitive: false,
        optional: true,
        help: "Націнка до базової ціни (можна від'ємну). Наприклад, 5 = +5%, -3 = -3%. Діапазон ±50%.",
      },
      {
        key: 'stockAllocationPercent',
        label: 'Алокація залишку, %',
        placeholder: '100',
        sensitive: false,
        optional: true,
        help: 'Який % загального залишку показувати на цьому маркетплейсі. 100 = весь залишок, 30 = 30%. Корисно щоб ділити запас між маркетплейсами і уникнути overselling.',
      },
      {
        key: 'commissionPercent',
        label: 'Комісія маркетплейсу, %',
        placeholder: '15',
        sensitive: false,
        optional: true,
        help: 'Середня комісія цього маркетплейсу з продажу (5-25%). Використовується для розрахунку чистого прибутку в Аналітиці. Залиште 0, якщо не знаєте — буде показано лише виручку.',
      },
    ],
  },
  {
    key: 'prom',
    name: 'Prom.ua',
    icon: '🔵',
    color: '#2b5797',
    description: 'Публікація товарів на Prom.ua',
    docsUrl: 'https://my.prom.ua/cabinet/access-api',
    docsLabel: 'Налаштування API Prom.ua',
    supports: { products: true, stock: true, orders: true },
    fields: [
      {
        key: 'apiToken',
        label: 'API Token',
        placeholder: 'Prom.ua API Token',
        sensitive: true,
        optional: false,
        help: 'Кабінет Prom → Налаштування → Доступ до API → Створити токен. Дайте права "Читання + Запис".',
      },
      {
        key: 'webhookSecret',
        label: 'Webhook Secret',
        placeholder: 'Секрет для перевірки підпису webhook',
        sensitive: true,
        optional: true,
        help: 'Секрет з налаштувань webhook у кабінеті Prom для перевірки HMAC-підпису. У production без нього всі POST блокуються (503). Не optional на проді.',
      },
      {
        key: 'priceMarkupPercent',
        label: 'Націнка, %',
        placeholder: '0',
        sensitive: false,
        optional: true,
        help: "Націнка до базової ціни (можна від'ємну). Наприклад, 5 = +5%, -3 = -3%. Діапазон ±50%.",
      },
      {
        key: 'stockAllocationPercent',
        label: 'Алокація залишку, %',
        placeholder: '100',
        sensitive: false,
        optional: true,
        help: 'Який % загального залишку показувати на цьому маркетплейсі. 100 = весь залишок, 30 = 30%. Корисно щоб ділити запас між маркетплейсами і уникнути overselling.',
      },
      {
        key: 'commissionPercent',
        label: 'Комісія маркетплейсу, %',
        placeholder: '15',
        sensitive: false,
        optional: true,
        help: 'Середня комісія цього маркетплейсу з продажу (5-25%). Використовується для розрахунку чистого прибутку в Аналітиці. Залиште 0, якщо не знаєте — буде показано лише виручку.',
      },
    ],
  },
  {
    key: 'epicentrk',
    name: 'Epicentr K',
    icon: '🟠',
    color: '#f57c00',
    description: 'Публікація товарів на маркетплейсі Епіцентр К',
    docsUrl: 'https://marketplace.epicentrk.ua/',
    docsLabel: 'Кабінет продавця Epicentr',
    supports: { products: true, stock: true, orders: true },
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        placeholder: 'Epicentr API Key',
        sensitive: true,
        optional: false,
        help: 'Кабінет продавця Epicentr → Налаштування → API → Згенерувати ключ.',
      },
      {
        key: 'sellerId',
        label: 'Seller ID',
        placeholder: '12345',
        sensitive: false,
        optional: false,
        help: 'ID продавця з кабінету Epicentr.',
      },
      {
        key: 'webhookSecret',
        label: 'Webhook Secret',
        placeholder: 'Секрет для перевірки підпису webhook',
        sensitive: true,
        optional: true,
        help: 'Секрет з налаштувань webhook у кабінеті Epicentr для перевірки HMAC-підпису. У production без нього всі POST блокуються (503). Не optional на проді.',
      },
      {
        key: 'priceMarkupPercent',
        label: 'Націнка, %',
        placeholder: '0',
        sensitive: false,
        optional: true,
        help: "Націнка до базової ціни (можна від'ємну). Наприклад, 5 = +5%, -3 = -3%. Діапазон ±50%.",
      },
      {
        key: 'stockAllocationPercent',
        label: 'Алокація залишку, %',
        placeholder: '100',
        sensitive: false,
        optional: true,
        help: 'Який % загального залишку показувати на цьому маркетплейсі. 100 = весь залишок, 30 = 30%. Корисно щоб ділити запас між маркетплейсами і уникнути overselling.',
      },
      {
        key: 'commissionPercent',
        label: 'Комісія маркетплейсу, %',
        placeholder: '15',
        sensitive: false,
        optional: true,
        help: 'Середня комісія цього маркетплейсу з продажу (5-25%). Використовується для розрахунку чистого прибутку в Аналітиці. Залиште 0, якщо не знаєте — буде показано лише виручку.',
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

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'ніколи';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return 'щойно';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} с тому`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} хв тому`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} год тому`;
  const day = Math.floor(hr / 24);
  return `${day} дн тому`;
}
