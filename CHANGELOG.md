# Changelog

Усі зміни проєкту документуються у цьому файлі.

## [1.0.0] — 2026-03-24

### Платформа

- **175K рядків TypeScript** (strict mode) — enterprise-grade e-commerce
- **102 сторінки:** 42 магазин + 19 кабінет + 60 адмін
- **307 REST API endpoints** з Zod валідацією
- **94 Prisma моделі** в 22 schema-файлах
- **31 cron-задача** (email, sync, аналітика, cleanup)
- **20+ інтеграцій** з українськими та міжнародними сервісами

### Магазин і checkout

- Fulltext search через Typesense 27 (typo tolerance, instant search, facets)
- Фільтри (категорія, range-slider ціни, наявність, акції), 5 варіантів сортування
- Картка товару: zoom/lightbox галерея, Quick View модалка, floating buy bar
- Рекомендації, порівняння (до 4), нещодавно переглянуті, бандли
- Кошик з real-time перерахунком, swipe-to-delete, mini-cart preview
- 4-кроковий checkout + гостьовий + купони + бонусні бали
- Volume pricing — автоматична знижка при великих кількостях

### Особистий кабінет (19 сторінок)

- Замовлення з timeline, PDF рахунок, повторне замовлення
- 2FA (TOTP + backup codes), історія входів
- Лояльність: 4 рівні (Bronze→Platinum), стріки, челенджі
- Реферальна програма, множинні вішлісти, сповіщення
- Bulk order (Excel/CSV), підписки (Subscribe & Save)
- Прогнози покупок, прайс-листи (PDF)
- GDPR: self-delete акаунту + data export

### B2B / Wholesale

- 3 рівні гуртових цін + персональне per-client ціноутворення
- Volume pricing engine, bulk order (CSV import)
- Комерційна пропозиція (PDF), кредитний ліміт, палетна доставка
- Персональний менеджер

### Адмін-панель (60 сторінок)

- Замовлення, товари, категорії, склади, користувачі, повернення, audit log
- Аналітика (18 вкладок): KPI, ABC, RFM, когорти, LTV, churn, forecast
- 13 типів звітів (PDF + Excel), алерти (Telegram/email)
- Маркетинг: банери, CMS, FAQ, блог, email-кампанії, публікації
- Live chat (WebSocket), 3 теми, SEO-шаблони, SEO-аудит

### Інтеграції (20+)

- **Оплата:** LiqPay, Monobank, WayForPay (redirect, webhooks, refunds)
- **Доставка:** Нова Пошта, Укрпошта, палетна, самовивіз
- **Боти:** Telegram (каталог, пошук, замовлення), Viber (нотифікації)
- **Соцмережі:** Facebook CAPI + Pixel, Instagram (публікації, insights)
- **Маркетплейси:** Prom.ua, Rozetka, OLX, Epicentr K (sync кожні 6 год)
- **ERP:** 1С/BAS (товари, ціни, залишки, замовлення)
- **Аналітика:** GA4 (Measurement Protocol), Facebook Pixel + CAPI
- **Моніторинг:** Sentry, Axiom, UptimeRobot
- **CDN/Storage:** Cloudflare, R2 (S3-compatible)
- **Пошук:** Typesense 27, **Push:** VAPID, **Auth:** Google OAuth 2.0
- **SEO:** Search Console, Merchant Center, Shopping feed, JSON-LD

### SaaS / Multi-tenancy

- Tenant isolation, subdomain routing, per-tenant Prisma context
- 3 тарифних плани, інвойси, usage metering
- Кастомні домени (DNS verify, auto SSL)
- Feature flags, white-label

### Безпека

- JWT RS256 з ротацією + reuse detection
- Rate limiting: Redis sliding window (глобальний + per-route)
- CSRF, XSS (DOMPurify), 12 security headers (CSP+nonce, HSTS, COEP, COOP)
- Idempotency (X-Idempotency-Key), cookie consent, GDPR

### Тестування

- **659 unit test files** (Vitest) — 100% coverage всіх шарів
- **61 E2E spec** (Playwright) — всі критичні user/admin flows
- **1,177 manual test cases** (30 файлів) — desktop + mobile responsive
- **19 integration tests**, **4 load test scripts** (k6)

### Документація

- **29 setup guides** (4,500+ рядків) — від local dev до production
- **88 файлів документації** (26K рядків)
- **.env reference** (73 змінні), platform analysis, architecture docs

### DevOps

- Docker (multi-stage, standalone, ~60MB), Docker Compose (5 services)
- GitHub Actions CI/CD + automated daily backups
- PM2 cluster mode, Nginx, Let's Encrypt SSL
- PWA: Service Worker, offline mode, push notifications
- i18n: uk/en (next-intl), ready for PL/RO/CZ

---

## [0.1.0] — 2026-02-22

### Додано

- Каталог товарів з повнотекстовим пошуком та фільтрацією
- Гуртово-роздрібна система ціноутворення з персональними цінами
- Кошик з об'єднанням після авторизації
- Система замовлень зі статусною моделлю
- Адмін-панель (18 сторінок): замовлення, товари, категорії, користувачі, імпорт, аналітика, налаштування
- Кабінет клієнта з різною навігацією для роздрібних та гуртових покупців
- Імпорт товарів з Excel з автоматичною валідацією та створенням категорій
- Telegram-бот з каталогом, пошуком, акціями та нотифікаціями
- 3 теми оформлення
- Генерація PDF: рахунки-фактури, видаткові накладні, комерційні пропозиції
- Push-сповіщення через Service Worker
- Реферальна та бонусна програми
- Інтеграція з Новою Поштою та Укрпоштою
- Оплата через LiqPay та Monobank
- Unit-тести (467 тестів), E2E тести (Playwright)
