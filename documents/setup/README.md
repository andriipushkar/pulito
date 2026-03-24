# Налаштування проєкту — Порошок

Покрокові інструкції для налаштування кожного компонента.

## Швидкий старт

| Крок | Файл | Що налаштувати |
|------|------|----------------|
| 1 | [01-local-development.md](01-local-development.md) | Запуск локально (Docker, .env, Prisma) |
| 2 | [02-production-vps.md](02-production-vps.md) | Деплой на VPS (Node, PM2, Nginx, SSL) |

## Інтеграції

| Файл | Сервіс |
|------|--------|
| [03-telegram-bot.md](03-telegram-bot.md) | Telegram Bot |
| [04-viber-bot.md](04-viber-bot.md) | Viber Bot |
| [05-payment-providers.md](05-payment-providers.md) | Оплата (LiqPay, Monobank, WayForPay) |
| [06-delivery-providers.md](06-delivery-providers.md) | Доставка (Нова Пошта, Укрпошта) |
| [07-email-smtp.md](07-email-smtp.md) | Email (SMTP) |
| [08-google-oauth.md](08-google-oauth.md) | Google OAuth |
| [09-instagram.md](09-instagram.md) | Instagram |
| [13-push-notifications.md](13-push-notifications.md) | Push-сповіщення (VAPID) |
| [14-typesense-search.md](14-typesense-search.md) | Typesense пошук |
| [15-marketplaces.md](15-marketplaces.md) | Маркетплейси (OLX, Rozetka, Prom, Epicentr) |

## Інфраструктура

| Файл | Сервіс |
|------|--------|
| [10-monitoring.md](10-monitoring.md) | Моніторинг (Sentry, Axiom, UptimeRobot) |
| [11-backups.md](11-backups.md) | Бекапи |
| [12-seo-analytics.md](12-seo-analytics.md) | SEO & Аналітика |
| [cloudflare/](cloudflare/) | Cloudflare CDN |
| [18-jwt-setup.md](18-jwt-setup.md) | JWT RS256 (генерація ключів, ротація, бекап) |

## Бази даних

| Файл | Сервіс |
|------|--------|
| [16-database-prisma.md](16-database-prisma.md) | Prisma: міграції, seed, PgBouncer |

## SaaS / Розширення

| Файл | Сервіс |
|------|--------|
| [19-1c-integration.md](19-1c-integration.md) | Інтеграція з 1С/BAS |
| [20-multi-tenancy.md](20-multi-tenancy.md) | Multi-tenancy (SaaS режим) |
| [21-billing-plans.md](21-billing-plans.md) | Тарифні плани та інвойси |
| [22-custom-domains.md](22-custom-domains.md) | Кастомні домени для тенантів |
| [23-email-campaigns.md](23-email-campaigns.md) | Email-кампанії та послідовності |
| [24-feature-flags.md](24-feature-flags.md) | Feature flags |
| [25-gdpr-privacy.md](25-gdpr-privacy.md) | GDPR / Privacy |

## Довідник

| Файл | Що містить |
|------|-----------|
| [17-env-reference.md](17-env-reference.md) | Повний довідник всіх змінних .env з поясненнями |
| [test-accounts.md](test-accounts.md) | Тестові акаунти для перевірки інтеграцій |
