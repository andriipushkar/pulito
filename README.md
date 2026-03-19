# Порошок — Інтернет-магазин побутової хімії

![CI](https://github.com/smdshrek/clean/actions/workflows/ci.yml/badge.svg)
![Daily Backup](https://github.com/smdshrek/clean/actions/workflows/backup.yml/badge.svg)

Оптово-роздрібна платформа інтернет-магазину побутової хімії з повним циклом: каталог, замовлення, онлайн-оплата, доставка, CRM, аналітика.

## Стек технологій

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Мова:** TypeScript 5.9
- **UI:** React 19, Tailwind CSS 4
- **База даних:** PostgreSQL 16 + Prisma ORM
- **Кеш/Rate limiting:** Redis 7
- **Аутентифікація:** JWT (httpOnly cookies) + Google OAuth + bcryptjs
- **Платежі:** LiqPay, Monobank, WayForPay
- **Доставка:** Нова Пошта API, Укрпошта API, палетна доставка
- **PDF:** PDFKit (рахунки, накладні, комерційні пропозиції, каталог)
- **Email:** Nodemailer
- **Push-сповіщення:** Web Push (VAPID)
- **Боти:** Telegram Bot API, Viber Bot API
- **Тестування:** Vitest (unit/integration, 400+ тестів), Playwright (E2E, 15 suites)
- **CI/CD:** GitHub Actions → staging/production
- **Інфраструктура:** Docker, Docker Compose, standalone output

## Quick Start

### Передумови

- Node.js >= 20
- PostgreSQL >= 16
- Redis >= 7

### Встановлення

```bash
git clone <repo-url> && cd clean
npm install
cp .env.example .env
# Заповнити DATABASE_URL, REDIS_URL, JWT_SECRET та інші змінні

npm run docker:up        # PostgreSQL + Redis
npm run db:generate      # Prisma-клієнт
npm run db:migrate       # Міграції
npm run db:seed          # Seed-дані
npm run dev              # http://localhost:3000
```

### Docker

```bash
docker compose up -d     # Все в Docker (app + PostgreSQL + Redis)
npm run docker:up        # Тільки PostgreSQL + Redis
npm run docker:down      # Зупинити
```

## Скрипти

| Скрипт | Опис |
|--------|------|
| `npm run dev` | Dev-сервер з Turbopack |
| `npm run build` | Продакшн-білд |
| `npm start` | Продакшн-сервер |
| `npm run lint` | ESLint |
| `npm test` | Unit/integration тести |
| `npm run test:coverage` | Тести з покриттям (99/96/98/99%) |
| `npm run test:e2e` | E2E тести (Playwright) |
| `npm run analyze` | Bundle analyzer |
| `npm run db:migrate` | Prisma міграції |
| `npm run db:studio` | Prisma Studio GUI |

## Структура проєкту

```
src/
├── app/
│   ├── (shop)/           # Магазин: каталог, товар, кошик, оформлення, кабінет
│   ├── (admin)/          # Адмін-панель (31 сторінка)
│   └── api/v1/           # REST API (70+ ендпоінтів)
├── components/           # React-компоненти (UI, layout, product, checkout)
├── services/             # Бізнес-логіка (замовлення, платежі, доставка, аналітика)
├── validators/           # Zod-схеми валідації
├── hooks/                # React-хуки (кошик, wishlist, порівняння, auth)
├── middleware/            # Auth middleware (withAuth, withRole, withOptionalAuth)
├── config/               # Environment validation (Zod)
├── lib/                  # Prisma, Redis, API client
└── utils/                # Допоміжні функції
prisma/
├── schema.prisma         # 30+ моделей
└── migrations/           # Міграції
e2e/                      # 15 Playwright test suites
```

## Основні можливості

### Магазин
- Каталог з повнотекстовим пошуком (PostgreSQL tsvector)
- Роздрібні та оптові ціни з персональним ціноутворенням і wholesale-групами
- Кошик з об'єднанням після авторизації
- Wishlist (множинні списки), порівняння товарів (до 4), історія переглядів
- Відгуки та рейтинги (модерація, verified purchase, helpful votes)
- Купони та промокоди (%, фіксовані, безкоштовна доставка)
- Система повернень (RMA з 14-денним вікном)

### Замовлення та оплата
- 4-крокове оформлення (контакти → доставка → оплата → підтвердження)
- **Онлайн-оплата:** LiqPay (SHA1), Monobank (RSA-SHA256), WayForPay (HMAC-MD5)
- Оплата при отриманні, банківський переказ, передоплата на картку
- Бонусна програма лояльності (списання балів при оформленні)

### Доставка
- **Нова Пошта:** пошук міст/відділень, розрахунок вартості, створення ТТН, трекінг
- **Укрпошта:** створення відправлень, PDF-накладна, трекінг
- **Палетна доставка:** калькулятор по регіонах, конфігурація з адмінки
- Самовивіз

### Адмін-панель (31 сторінка)
- Dashboard з real-time статистикою та drag-and-drop віджетами
- Аналітика: Revenue, AOV, конверсійна воронка, когорти, ABC-аналіз, RFM, LTV, churn prediction, географія, канали
- Експорт: XLSX, CSV, PDF (13 шаблонів звітів + custom report builder)
- Ролі: client, wholesaler, manager, admin
- Audit log (15+ типів дій, фільтрація, CSV-експорт)
- Управління: товари, категорії, бейджі, банери, сторінки, FAQ, публікації
- Імпорт товарів з Excel з валідацією та логами
- SEO-шаблони, теми оформлення (3 теми)
- Модерація контенту, email-шаблони, персональні ціни

### Комунікації
- **Telegram-бот:** каталог, пошук, замовлення, сповіщення
- **Viber-бот:** сповіщення про замовлення та доставку
- **Email:** верифікація, скидання пароля, сповіщення про замовлення
- **Push-сповіщення:** Web Push через Service Worker
- Мультиканальна черга сповіщень з налаштуваннями користувача

### PWA та мобільний досвід
- Service Worker з 3-рівневим кешуванням (static, dynamic pages, API)
- Offline-режим (каталог, товари, кошик доступні офлайн)
- Install Prompt (кастомний банер, 14-денний cooldown)
- App shortcuts (каталог, кошик, замовлення, порівняння)
- Mobile bottom nav з glass morphism та smart hide/show
- Push notifications

### Безпека
- JWT: access (15 хв) + refresh (30 днів) з ротацією та reuse detection
- Refresh tokens: httpOnly cookies, SHA256 hash в БД
- Rate limiting: Redis-based sliding window (глобальний + per-route)
- CSRF: Origin/Referer + X-Requested-With header
- Google OAuth 2.0 з signed state (HMAC-SHA256)
- Token blacklisting (Redis з TTL)
- Security headers: HSTS (2 роки), CSP, X-Frame-Options: DENY
- Input validation: Zod + DOMPurify (HTML sanitization)

### SEO та маркетинг
- Schema.org: Product (Brand, shipping, returns), Breadcrumb, FAQ, Organization, CollectionPage
- Open Graph + Twitter Cards на всіх сторінках
- Динамічний sitemap.xml, robots.txt, canonical URLs, hreflang (uk/en)
- Google Shopping XML feed (`/feed/google-shopping`)
- RSS feed (`/feed.xml`)
- ISR: каталог (60с), товари (120с), FAQ/новини (300с)
- SEO-шаблони з адмінки

### Продуктивність
- ISR (Incremental Static Regeneration) для каталогу та товарів
- Lazy loading компонентів (20+ dynamic imports)
- Redis-кешування (TTL tiers: 60с, 300с, 1ч, 24ч)
- Bundle analyzer (`npm run analyze`)
- CDN support (`CDN_URL` env)
- WebP/AVIF images, font-display: swap, preconnect hints

### Реферальна та бонусна програми
- Реферальна програма (унікальні коди, бонуси за покупку реферала)
- Бонусна програма лояльності (рівні, нарахування балів, списання при оформленні)

### DevOps
- **CI/CD:** GitHub Actions (lint → test → build → e2e → deploy staging → deploy production)
- **Docker:** 3-stage Dockerfile, standalone output, non-root user
- **Docker Compose:** app + PostgreSQL 16 + Redis 7 з healthchecks
- **Health checks:** `/api/v1/health` (DB + Redis) + зовнішні сервіси (Нова Пошта, LiqPay, SMTP)
- **Backup:** `scripts/backup.sh` (DB + uploads, 30-денна ротація)
- **Моніторинг:** PM2, Web Vitals reporter

## Тестування

- **400+ unit/integration тестів** (Vitest) — сервіси, API routes, компоненти, валідатори
- **15 E2E suites** (Playwright) — auth, checkout, cart, catalog, admin, search
- **Coverage thresholds:** 99% statements, 96% branches, 98% functions, 99% lines
- **CI:** Автоматичний запуск на кожен push/PR

## Деплой

Див. [DEPLOYMENT.md](./DEPLOYMENT.md) — PM2, Nginx, SSL, firewall, backup, моніторинг.

## Ліцензія

Приватний проєкт.
