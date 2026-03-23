# Clean Shop — Архітектура

## Загальна архітектура

Clean Shop — це монолітний Full-stack застосунок на базі **Next.js 16** (App Router) з **React 19**, **Prisma ORM** (PostgreSQL), **Redis** кешуванням та **BullMQ** чергами.

```
┌──────────────────────────────────────────────────────────────────┐
│                        Next.js App Router                        │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  (shop)      │  │  (admin)     │  │  (auth)              │   │
│  │  pages       │  │  pages       │  │  login / register    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
│         ▼                 ▼                      ▼               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   API Routes (src/app/api/v1/)           │   │
│  │   auth/ | products/ | orders/ | categories/ | cron/      │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │                  Service Layer (src/services/)            │   │
│  │  product | cart | order | payment | delivery | ...        │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌────────────┐     ┌──────────────┐     ┌──────────────┐     │
│  │   Prisma   │     │    Redis     │     │   BullMQ     │     │
│  │  (DB ORM)  │     │   (Cache)    │     │  (Queues)    │     │
│  └──────┬─────┘     └──────────────┘     └──────────────┘     │
│         │                                                       │
└─────────┼───────────────────────────────────────────────────────┘
          ▼
   ┌──────────────┐
   │  PostgreSQL   │
   │  (Database)   │
   └──────────────┘
```

## Стек технологій

| Шар | Технологія | Версія |
|-----|-----------|--------|
| Frontend | React + Next.js App Router | 19 / 16 |
| Стилі | TailwindCSS v4 | 4.1 |
| ORM | Prisma + pg adapter | 7.4 |
| БД | PostgreSQL | 15+ |
| Кеш | Redis (ioredis) | 6+ |
| Черги | BullMQ | 5.x |
| Auth | JWT (bcryptjs + jsonwebtoken) | — |
| Email | Nodemailer | 8.x |
| PDF | PDFKit | 0.17 |
| Зображення | Sharp | 0.34 |
| Excel | xlsx | 0.18 |
| i18n | next-intl | 4.8 |
| Тести | Vitest + Playwright | 4.x / 1.x |

## Структура каталогу

```
src/
├── app/                    # Next.js App Router
│   ├── (shop)/             # Сторінки магазину (каталог, кошик, кабінет)
│   ├── (admin)/            # Адмін-панель (31 сторінка)
│   ├── (auth)/             # Авторизація (login, register, verify)
│   ├── api/v1/             # REST API ендпоінти
│   └── api/webhooks/       # Webhook handlers (Telegram, Viber)
├── components/             # React компоненти
│   ├── admin/              # Компоненти адмінки
│   ├── catalog/            # Каталог, фільтри, сортування
│   ├── checkout/           # Оформлення замовлення
│   ├── product/            # Картка товару, деталі, ціни
│   ├── layout/             # Header, Footer, Navigation
│   └── ui/                 # Базові UI (Button, Modal, Spinner, Badge)
├── services/               # Бізнес-логіка (57 сервісів)
│   └── jobs/               # Cron-задачі (13 job-файлів)
├── lib/                    # Бібліотеки (Redis, Prisma, API client)
├── hooks/                  # React hooks (useAuth, useCart, useTheme)
├── validators/             # Zod-схеми валідації
├── middleware/              # Auth middleware
├── types/                  # TypeScript типи
├── config/                 # Конфігурація середовища (Zod env)
├── utils/                  # Утиліти (slug, format, cookies)
└── i18n/                   # Інтернаціоналізація (uk/en)
```

## Потік даних

### Клієнтський запит
```
Browser → Next.js Route Handler → Service → Prisma → PostgreSQL
                                       ↕
                                    Redis Cache
```

### Типовий flow для GET /api/v1/products:

1. **Route Handler** (`src/app/api/v1/products/route.ts`) — валідація query params через Zod
2. **Cache Check** (`src/services/cache.ts`) — `cacheGet('products:list:...')`
3. **Cache Hit** → повернення з Redis (TTL: 5 хв)
4. **Cache Miss** → **Service** (`src/services/product.ts`) → Prisma query → PostgreSQL
5. **Cache Write** → `cacheSet(key, result, CACHE_TTL.MEDIUM)`
6. **Response** → JSON через `successResponse()`

### Пошук товарів (3-рівнева система):
1. **Exact code match** — `code ILIKE '%query%'` → 100 балів
2. **Full-text search** — `ts_rank_cd(search_vector, plainto_tsquery())` → до 10 балів
3. **Trigram similarity** — `similarity(name, query)` (pg_trgm) → до 5 балів

## Кешування

| Ресурс | TTL | Ключ | Інвалідація |
|--------|-----|------|-------------|
| Список товарів | 5 хв (MEDIUM) | `products:list:{filters}` | CRUD товарів, імпорт |
| Деталі товару | 1 год (LONG) | `products:slug:{slug}` | Оновлення товару |
| Автокомпліт | 1 хв (SHORT) | `products:autocomplete:{query}` | CRUD товарів |
| Категорії | 1 год (LONG) | `categories:list:{scope}` | CRUD категорій |

## Аутентифікація

- **JWT Access Token** — 15 хвилин (в cookies)
- **JWT Refresh Token** — 30 днів (в БД, hash)
- **Google OAuth** — через Google Client ID/Secret
- **Middleware** — перевірка токена на рівні API routes

## Інтеграції

### Telegram Bot
- Каталог товарів через inline buttons
- Пошук, кошик, замовлення
- Сповіщення клієнтам (статус замовлення)
- Сповіщення менеджерам (нове замовлення)

### Viber Bot
- Rich media каталог
- Keyboard-based навігація
- Сповіщення про замовлення

### Instagram
- Публікація постів, каруселей, reels
- Збір Insights (щоденний cron)
- Автоматичне оновлення long-lived token

### Nova Poshta API
- Пошук міст та відділень
- Розрахунок вартості доставки
- Трекінг посилок (автоматичний cron)

### LiqPay / Monobank
- Онлайн оплата (структура готова)
- Callback обробка

### SMTP (Nodemailer)
- 15+ email-шаблонів з версіонуванням
- Верифікація email
- Сповіщення про замовлення

## Cron-задачі

| Задача | Ендпоінт | Рекомендований інтервал |
|--------|----------|------------------------|
| Автоскасування замовлень | `/api/v1/cron/auto-cancel` | кожну годину |
| Публікація постів | `/api/v1/cron/publications` | кожні 5 хв |
| Обробка черги сповіщень | `/api/v1/cron/notifications` | кожну хвилину |
| Очищення токенів | `/api/v1/cron/cleanup-tokens` | щодня |
| Очищення кошиків | `/api/v1/cron/cleanup-carts` | щодня |
| Health check | `/api/v1/cron/health-check` | кожні 5 хв |
| Instagram Insights | `/api/v1/cron/instagram-insights` | щодня |
| Instagram Token Refresh | `/api/v1/cron/instagram-token-refresh` | щомісяця |
| Автоматичні бейджі | `/api/v1/cron/auto-badges` | щодня |
| Трекінг посилок | `/api/v1/cron/auto-tracking` | кожні 2 год |
| Analytics digest | `/api/v1/cron/analytics-digest` | щодня |
| Analytics alerts | `/api/v1/cron/analytics-alerts` | кожну годину |

Всі cron-ендпоінти захищені Bearer token (`APP_SECRET`):
```bash
curl -X POST -H "Authorization: Bearer $APP_SECRET" \
  http://localhost:3000/api/v1/cron/cleanup-tokens
```

## Схема бази даних

### Основні моделі (50+ таблиць)

**Користувачі:** User, RefreshToken, UserAddress, DashboardSettings
**Каталог:** Product, ProductContent, ProductImage, ProductBadge, Category
**Торгівля:** Order, OrderItem, OrderStatusHistory, CartItem, Wishlist, WishlistItem
**Фінанси:** Payment, PriceHistory, PersonalPrice, WholesaleRule
**Доставка:** Delivery (Nova Poshta, Ukrposhta, пікап, паллетна)
**Контент:** StaticPage, FaqItem, Banner, Theme, SeoTemplate
**Аналітика:** ClientEvent, DailyFunnelStats, PerformanceMetric
**Комунікації:** Notification, PushSubscription, PublicationQueue
**Лояльність:** LoyaltyAccount, LoyaltyTransaction, LoyaltyLevel
**Аудит:** AuditLog, ImportLog

## Теми оформлення

Три теми відповідно до ТЗ:
- **freshness** — «Свіжість та Органіка» (активна за замовчуванням)
- **crystal** — «Кристальна чистота»
- **cozy** — «Домашній затишок»

Перемикання через CSS custom properties (`--color-primary`, `--color-bg`, тощо).

## Тестування

- **Unit тести:** Vitest (53 файли, 485+ тестів)
- **E2E тести:** Playwright (11 специфікацій)
- **Покриття:** auth, cart, order, product, category, import, payment, validators, utils
- **Запуск:** `npm run test` (unit), `npm run test:e2e` (E2E)
