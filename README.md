# Порошок — Enterprise E-commerce Platform

![CI](https://github.com/smdshrek/clean/actions/workflows/ci.yml/badge.svg)
![Daily Backup](https://github.com/smdshrek/clean/actions/workflows/backup.yml/badge.svg)

Оптово-роздрібна платформа на Next.js 16 з multi-tenancy, SaaS billing, 20+ інтеграціями, B2B-ціноутворенням та повним тестовим покриттям.

| Метрика | Значення |
|---------|---------|
| TypeScript | 175K рядків (strict mode) |
| API endpoints | 307 |
| Сторінки | 102 (42 магазин + 60 адмін) |
| DB models | 94 (Prisma, 22 schema files) |
| Test:Code ratio | 97% |
| Документація | 26K рядків (88 файлів) |

## Стек технологій

- **Framework:** Next.js 16 (App Router, RSC, Server Actions, ISR, Turbopack)
- **UI:** React 19, TypeScript 5.9, Tailwind CSS 4
- **БД:** PostgreSQL 16 + Prisma 7.4 + PgBouncer
- **Кеш:** Redis 7 (cache, sessions, rate limiting, BullMQ queues)
- **Пошук:** Typesense 27 (fulltext, typo tolerance, facets)
- **Аутентифікація:** JWT RS256 (httpOnly cookies) + Google OAuth + 2FA (TOTP)
- **Платежі:** LiqPay, Monobank, WayForPay
- **Доставка:** Нова Пошта, Укрпошта, палетна, самовивіз
- **Боти:** Telegram Bot, Viber Bot
- **Email:** Nodemailer (SMTP), campaigns, sequences, abandoned cart
- **Push:** Web Push (VAPID, Service Worker)
- **Маркетплейси:** Prom.ua, Rozetka, OLX, Epicentr K
- **ERP:** 1С / BAS інтеграція
- **Аналітика:** GA4 (Measurement Protocol), Facebook Pixel + CAPI
- **Моніторинг:** Sentry + Axiom + UptimeRobot
- **CDN/Storage:** Cloudflare, R2 (S3-compatible)
- **PDF:** PDFKit (рахунки, накладні, каталог, комерційні пропозиції)
- **Images:** Sharp (WebP, AVIF, watermark)
- **Тестування:** Vitest (659 unit files), Playwright (61 E2E specs), k6 (load testing)
- **CI/CD:** GitHub Actions (lint → test → build → e2e → deploy)
- **Інфраструктура:** Docker, Docker Compose, PM2, Nginx

## Quick Start

### Передумови

- Node.js >= 20
- Docker + Docker Compose

### Встановлення

```bash
git clone <repo-url> && cd clean
npm install
cp .env.example .env
# Заповнити DATABASE_URL, REDIS_URL, JWT_SECRET

docker compose up -d          # PostgreSQL + PgBouncer + Redis + Typesense
npm run db:generate            # Prisma Client
npm run db:migrate             # Міграції
npm run db:seed                # Seed-дані
npm run dev                    # http://localhost:3000
```

Детальна інструкція: [documents/setup/01-local-development.md](documents/setup/01-local-development.md)

## Скрипти

| Скрипт | Опис |
|--------|------|
| `npm run dev` | Dev-сервер з Turbopack |
| `npm run build` | Production-білд |
| `npm start` | Production-сервер |
| `npm run lint` | ESLint |
| `npm test` | Unit/integration тести (Vitest) |
| `npm run test:coverage` | Тести з покриттям |
| `npm run test:e2e` | E2E тести (Playwright) |
| `npm run analyze` | Bundle analyzer |
| `npm run db:migrate` | Prisma міграції |
| `npm run db:studio` | Prisma Studio GUI |

## Структура проєкту

```
src/
├── app/
│   ├── (shop)/           # Магазин (42 сторінки)
│   ├── (admin)/          # Адмін-панель (60 сторінок)
│   └── api/v1/           # REST API (307 ендпоінтів)
├── components/           # React-компоненти (138 файлів)
├── services/             # Бізнес-логіка (92 сервіси)
├── validators/           # Zod-схеми (25 валідаторів)
├── hooks/                # React-хуки (17)
├── middleware/            # Auth, rate limiting (5)
├── lib/                  # Prisma, Redis, API client
└── utils/                # Допоміжні функції (18)
prisma/
├── schema/               # 22 schema files, 94 models
└── migrations/           # Міграції
e2e/                      # 61 Playwright E2E specs
documents/
├── setup/                # 29 setup guides (4,500+ рядків)
├── testing/              # 1,177 manual test cases (30 файлів)
├── modules/              # Документація модулів (10 файлів)
├── architecture/         # ADR, DB schema (8 файлів)
└── project/              # Changelog, platform analysis
```

## Основні можливості

### Магазин (42 сторінки)
- Каталог з fulltext search (Typesense), фільтрами, сортуванням
- Картка товару: zoom/lightbox галерея, Quick View, floating buy bar
- Рекомендації «З цим купують», порівняння до 4 товарів, нещодавно переглянуті
- Бандли (набори зі знижкою), калькулятор витрат на прибирання
- Кошик з real-time перерахунком, swipe-to-delete (mobile), mini-cart
- 4-кроковий checkout + гостьовий checkout + купони + бонусні бали
- Volume pricing — автоматична знижка при великих кількостях

### Особистий кабінет (19 сторінок)
- Замовлення з timeline статусів, PDF рахунок, повторне замовлення
- 2FA (TOTP + backup codes), історія входів
- Лояльність: 4 рівні (Bronze→Platinum), стріки, челенджі
- Реферальна програма, множинні вішлісти
- Bulk order (Excel/CSV), підписки (Subscribe & Save)
- Прогнози покупок, прайс-листи (PDF)
- GDPR: self-delete акаунту + data export

### B2B / Wholesale
- 3 рівні оптових цін + персональне ціноутворення per-client
- Volume pricing engine, bulk order (CSV import)
- Комерційна пропозиція (PDF), кредитний ліміт
- Палетна доставка, персональний менеджер

### Адмін-панель (60 сторінок)
- Замовлення: фільтри, статуси, bulk-операції, ТТН, PDF
- Товари: CRUD, images (watermark, WebP/AVIF), drag-and-drop, Excel import
- Аналітика (18 вкладок): KPI, ABC, RFM, когорти, LTV, churn, forecast
- 13 типів звітів (PDF + Excel), алерти (Telegram/email)
- Маркетинг: банери, CMS, FAQ, блог, email-кампанії, публікації
- Multi-warehouse, audit log, live chat (WebSocket)
- 3 теми оформлення, SEO-шаблони, SEO-аудит

### SaaS / Multi-tenancy
- Tenant isolation, subdomain routing
- 3 тарифних плани, інвойси, usage metering
- Custom domains (DNS verify, auto SSL)
- Feature flags, white-label, 3 themes

### 20+ інтеграцій

| Категорія | Сервіси |
|-----------|---------|
| Оплата | LiqPay, Monobank, WayForPay |
| Доставка | Нова Пошта, Укрпошта, палетна |
| Боти | Telegram, Viber |
| Соцмережі | Facebook, Instagram |
| Маркетплейси | Prom.ua, Rozetka, OLX, Epicentr K |
| ERP | 1С / BAS |
| Analytics | GA4, Facebook Pixel + CAPI |
| Monitoring | Sentry, Axiom, UptimeRobot |
| CDN/Storage | Cloudflare, R2 |
| Пошук | Typesense 27 |
| Auth | Google OAuth 2.0 |
| Push | Web Push (VAPID) |
| Email | SMTP (transactional + campaigns + sequences) |
| SEO | Search Console, Merchant Center, Shopping feed |

### Безпека
- JWT RS256 з ротацією + reuse detection
- Rate limiting: Redis sliding window (глобальний + per-route)
- CSRF (Origin + X-Requested-With), XSS (DOMPurify)
- 12 security headers: CSP+nonce, HSTS, COEP, COOP
- Idempotency (X-Idempotency-Key for orders)
- Cookie consent (3 categories), GDPR compliance

### PWA
- Service Worker з 3-рівневим кешуванням
- Offline-режим, install prompt, app shortcuts
- Push notifications

### SEO
- Schema.org (Product, FAQ, Organization, Breadcrumb)
- Sitemap (chunked), robots.txt, canonical, hreflang (uk/en)
- Google Shopping XML feed, RSS feed
- OG + Twitter Cards, ISR

## Тестування

| Тип | Кількість |
|-----|-----------|
| Unit test files (Vitest) | 659 |
| E2E specs (Playwright) | 61 |
| Manual test cases | 1,177 (30 файлів) |
| Integration tests | 19 |
| Load tests (k6) | 4 (smoke, load, stress, spike) |

**100% automated coverage:** services (92/92), API routes (307/307), components (138/137), cron (31/31), validators (25/25), hooks (17/17), lib (18/18), middleware (5/5), providers (4/4).

## Документація

- **29 setup guides** — від local dev до production з усіма інтеграціями
- **1,177 manual test cases** — покрокові інструкції з тестовими даними
- **Повний .env reference** — 73 змінні з поясненнями
- **Architecture docs** — ADR, DB schema, modules

Дивіться: [documents/setup/README.md](documents/setup/README.md) | [documents/setup/00-checklist.md](documents/setup/00-checklist.md)

## Деплой

Дивіться [documents/setup/02-production-vps.md](documents/setup/02-production-vps.md) — 19 кроків від SSH до працюючого production:

DNS → SSH → Node.js → Docker → PM2 → Nginx → .env → DB → Build → SSL → Cron (31 задач) → Firewall → Verify

## Ліцензія

Proprietary. Дивіться [LICENSE](LICENSE).
