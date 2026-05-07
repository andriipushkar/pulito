# Налаштування cron-задач

Усі cron-endpoints доступні за маршрутом `/api/v1/cron/<name>` і захищені Bearer-токеном `${APP_SECRET}` (timing-safe comparison). Вони викликаються зовнішнім планувальником (GitHub Actions, Vercel Cron, system crontab — на вибір).

## Авторизація

Кожен запит мусить містити заголовок:

```
Authorization: Bearer <APP_SECRET>
```

`APP_SECRET` — мінімум 32 символи, генерується через `openssl rand -hex 32`. Та сама змінна що в `.env`.

## Список cron-endpoints

### Замовлення та доставка

| Endpoint                  | Recommended schedule | Що робить                                                                 |
| ------------------------- | -------------------- | ------------------------------------------------------------------------- |
| `auto-tracking`           | `*/30 * * * *`       | Оновлює tracking-статус NP замовлень, доставлені переводить у `completed` |
| `auto-cancel`             | `0 */6 * * *`        | Скасовує замовлення в `pending` >7 днів                                   |
| `payment-reconciliation`  | `*/15 * * * *`       | Catches missed payment webhooks, запитує статус прямо в провайдера        |
| `sync-marketplace-orders` | `*/15 * * * *`       | Синхронізація замовлень з OLX/Rozetka/Prom                                |
| `sync-marketplace-prices` | `0 */4 * * *`        | Синхронізація цін на маркетплейси                                         |
| `sync-marketplace-stock`  | `*/30 * * * *`       | Синхронізація залишків                                                    |

### Дані та аналітика

| Endpoint                | Recommended schedule | Що робить                                              |
| ----------------------- | -------------------- | ------------------------------------------------------ |
| `precompute-analytics`  | `0 2 * * *`          | Прекомп'ют KPI dashboards (нічний run)                 |
| `funnel-aggregate`      | `0 3 * * *`          | Агрегація воронки конверсій                            |
| `analytics-alerts`      | `0 9 * * *`          | Перевірка KPI порогів, алерт через Telegram            |
| `analytics-digest`      | `0 9 * * 1`          | Тижневий digest (понеділок ранок)                      |
| `weekly-report`         | `0 10 * * 1`         | Звіт по продажах за тиждень                            |
| `predictions`           | `0 4 * * *`          | ML-прогнози попиту/відтоку                             |
| `auto-badges`           | `0 5 * * *`          | Авто-присвоєння бейджів (best-seller, new, etc.)       |
| `build-recommendations` | `0 1 * * *`          | Пере-обрахунок "Схожі товари"                          |
| `reindex-products`      | `0 0 * * *`          | Повне переіндексування Typesense (нічна синхронізація) |
| `price-sync`            | `0 */1 * * *`        | Синхронізація цін з ERP (1С/BAS) якщо налаштовано      |

### Маркетинг

| Endpoint                | Recommended schedule | Що робить                                            |
| ----------------------- | -------------------- | ---------------------------------------------------- |
| `abandoned-carts`       | `0 */2 * * *`        | Email/Telegram нагадування про покинуті кошики (24h) |
| `email-campaigns`       | `*/15 * * * *`       | Запуск запланованих email-кампаній                   |
| `email-sequences`       | `*/30 * * * *`       | Welcome / re-engagement послідовності                |
| `notifications`         | `*/5 * * * *`        | Розсилання pending push/email/telegram сповіщень     |
| `process-subscriptions` | `0 6 * * *`          | Поновлення SaaS-підписок                             |
| `campaigns`             | `*/10 * * * *`       | Активація / деактивація промо-кампаній               |
| `promo-autopost`        | `0 */3 * * *`        | Автопости промо в Telegram/Instagram                 |
| `publications`          | `*/15 * * * *`       | Публікація запланованих постів у соцмережі           |
| `publish-scheduled`     | `*/5 * * * *`        | Видавання запланованих публікацій                    |

### Cleanup та обслуговування

| Endpoint               | Recommended schedule | Що робить                                           |
| ---------------------- | -------------------- | --------------------------------------------------- |
| `cleanup-carts`        | `0 4 * * *`          | Видалення гостьових кошиків старших 30 днів         |
| `cleanup-soft-deleted` | `0 5 * * *`          | Hard-delete soft-deleted записів (>90 днів)         |
| `cleanup-tokens`       | `0 3 * * *`          | Видалення expired refresh-токенів                   |
| `partition-rotate`     | `0 0 1 * *`          | Створення/видалення місячних партицій client_events |
| `db-backup`            | `0 3 * * *`          | Pg_dump → S3                                        |
| `health-check`         | `*/5 * * * *`        | Self-check всіх інтеграцій                          |

### Інші

| Endpoint                  | Recommended schedule | Що робить                                              |
| ------------------------- | -------------------- | ------------------------------------------------------ |
| `loyalty-daily`           | `0 2 * * *`          | Нарахування daily бонусів лояльності                   |
| `seo-check`               | `0 8 * * 0`          | SEO аудит (биті лінки, відсутні meta) — раз на тиждень |
| `instagram-insights`      | `0 4 * * *`          | Збір IG insights                                       |
| `instagram-token-refresh` | `0 0 1 * *`          | Refresh long-lived Instagram token (раз на місяць)     |

## Налаштування планувальника

### Варіант 1 — GitHub Actions (рекомендовано)

Готовий workflow для платежів і tracking: `.github/workflows/cron-payments-tracking.yml`. Можна додати додаткові:

```yaml
name: Daily ML predictions

on:
  schedule:
    - cron: '0 4 * * *'
  workflow_dispatch:

jobs:
  run:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Trigger cron
        env:
          PRODUCTION_URL: ${{ secrets.PRODUCTION_URL }}
          APP_SECRET: ${{ secrets.APP_SECRET }}
        run: |
          curl -sfX POST -H "Authorization: Bearer ${APP_SECRET}" \
            "${PRODUCTION_URL}/api/v1/cron/predictions"
```

**GitHub Secrets** потрібні:

- `PRODUCTION_URL` — наприклад `https://shop.example.com`
- `APP_SECRET` — той самий, що в `.env`

> **Важливо**: GitHub Actions cron має 5-min мінімум granularity і може затримуватись у пік-години. Для жорстких SLA (>=15 min) — використовуй self-hosted cron.

### Варіант 2 — System crontab (self-hosted VPS)

Відкрий `crontab -e` і додай:

```
# Payment & tracking (high priority)
*/15 * * * * curl -sfX POST -H "Authorization: Bearer YOUR-SECRET" https://shop.example.com/api/v1/cron/payment-reconciliation
*/30 * * * * curl -sfX POST -H "Authorization: Bearer YOUR-SECRET" https://shop.example.com/api/v1/cron/auto-tracking

# Marketplace sync
*/15 * * * * curl -sfX POST -H "Authorization: Bearer YOUR-SECRET" https://shop.example.com/api/v1/cron/sync-marketplace-orders
0 */4 * * * curl -sfX POST -H "Authorization: Bearer YOUR-SECRET" https://shop.example.com/api/v1/cron/sync-marketplace-prices

# Daily analytics
0 2 * * * curl -sfX POST -H "Authorization: Bearer YOUR-SECRET" https://shop.example.com/api/v1/cron/precompute-analytics
0 3 * * * curl -sfX POST -H "Authorization: Bearer YOUR-SECRET" https://shop.example.com/api/v1/cron/db-backup
```

Зберегти секрет в окрему файлу для безпеки (не в crontab plaintext):

```bash
echo "YOUR-SECRET" > /etc/cron-secret
chmod 600 /etc/cron-secret

# У crontab:
*/15 * * * * curl -sfX POST -H "Authorization: Bearer $(cat /etc/cron-secret)" https://shop.example.com/api/v1/cron/payment-reconciliation
```

### Варіант 3 — Vercel Cron

Якщо хостиш на Vercel, додай у `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/v1/cron/payment-reconciliation",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/v1/cron/auto-tracking",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

> Vercel автоматично авторизує власні cron requests через `Vercel-Cron` header. Треба адаптувати middleware для прийняття цього додатково до Bearer.

## Моніторинг

### Логи

Усі cron-задачі логують через `logger`. Перегляд у production:

```bash
pm2 logs pulito --lines 100 | grep cron
```

### Алерти при провалах

GitHub Actions можна налаштувати на Telegram-сповіщення при failure (приклад у `cron-payments-tracking.yml`).

Self-hosted cron можна обгорнути в healthcheck:

```bash
*/15 * * * * curl -sfX POST ... && curl https://hc-ping.com/<your-uuid> || curl https://hc-ping.com/<your-uuid>/fail
```

[healthchecks.io](https://healthchecks.io) — безкоштовний 20 cron-monitoring (free tier).

## Тестування

Викликати endpoint вручну:

```bash
curl -X POST -H "Authorization: Bearer $APP_SECRET" \
  https://shop.example.com/api/v1/cron/auto-tracking
```

**Очікувана відповідь**: `200 OK` з JSON `{ "success": true, "data": { ... } }`.

Без токену → `401 Unauthorized`.
З неправильним токеном → теж `401`.
При помилці job → `500 Internal Server Error`, лог через `logger.error`.

## Ідемпотентність

Усі cron-задачі **ідемпотентні** — повторний виклик не дублює даних. Внутрішня логіка має `lockKey` через Redis (де релевантно) щоб запобігти race conditions при паралельних firing'ах.
