# 23 — Email-кампанії та послідовності

Налаштування автоматичних email-послідовностей (welcome, win-back, review requests) та маркетингових кампаній.

## Передумови

- SMTP налаштовано → [07-email-smtp.md](07-email-smtp.md)
- Cron-задачі `email-campaigns` та `email-sequences` додані → [02-production-vps.md](02-production-vps.md)

## Крок 1 — Типи email-послідовностей

| Послідовність | Тригер | Emails | Інтервали |
|---------------|--------|--------|-----------|
| Welcome | Реєстрація нового клієнта | 3 | День 0, День 3, День 7 |
| Win-back | Клієнт не купував 30+ днів | 2 | День 30, День 45 |
| Review request | Замовлення доставлено | 1 | Через 5 днів після доставки |
| Abandoned cart | Покинутий кошик 24+ години | 2 | Через 24 год, через 72 год |

## Крок 2 — Налаштування шаблонів

Через адмін-панель: **Маркетинг → Email шаблони**

Або через API:

```bash
curl -X POST http://localhost:3000/api/v1/admin/email-templates \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "welcome-day-0",
    "subject": "Ласкаво просимо до {{shopName}}!",
    "type": "sequence",
    "sequence": "welcome",
    "step": 0,
    "body": "<h1>Вітаємо, {{customerName}}!</h1><p>Дякуємо за реєстрацію...</p>"
  }'
```

Доступні змінні в шаблонах:

| Змінна | Значення |
|--------|---------|
| `{{customerName}}` | Ім'я клієнта |
| `{{shopName}}` | Назва магазину |
| `{{shopUrl}}` | URL магазину |
| `{{orderNumber}}` | Номер замовлення |
| `{{cartItems}}` | HTML-список товарів у кошику |
| `{{cartTotal}}` | Сума кошика |
| `{{unsubscribeUrl}}` | Посилання для відписки |

## Крок 3 — Маркетингові кампанії

Створення одноразової розсилки:

```bash
curl -X POST http://localhost:3000/api/v1/admin/campaigns \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Весняний розпродаж",
    "subject": "Знижки до -50% на всю побутову хімію!",
    "templateId": "campaign-spring-sale",
    "audience": {
      "filter": "has_ordered",
      "minOrders": 1
    },
    "scheduledAt": "2026-04-01T10:00:00Z"
  }'
```

Фільтри аудиторії:

| Фільтр | Опис |
|--------|------|
| `all` | Всі підписники |
| `has_ordered` | Клієнти з хоча б 1 замовленням |
| `vip` | Клієнти з 5+ замовленнями або сумою 10000+ |
| `inactive` | Не купували 60+ днів |
| `new` | Зареєстровані за останні 30 днів |

## Крок 4 — Cron-задачі

Дві cron-задачі обробляють email (вже налаштовані в [02-production-vps.md](02-production-vps.md)):

- **email-campaigns** (кожні 30 хв) — відправляє заплановані кампанії, батчами по 50 emails
- **email-sequences** (кожні 30 хв) — перевіряє та відправляє наступні кроки послідовностей

## Крок 5 — Перевірка роботи

```bash
# Перевірити що послідовності працюють
curl http://localhost:3000/api/v1/admin/email-sequences/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Перевірити чергу відправки
curl http://localhost:3000/api/v1/admin/campaigns \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## Troubleshooting

| Проблема | Рішення |
|----------|---------|
| Emails не відправляються | Перевірте SMTP → [07-email-smtp.md](07-email-smtp.md) |
| Послідовність не стартує | Перевірте що cron `email-sequences` працює: `crontab -l` |
| Кампанія "stuck" в статусі sending | Перевірте логи: `pm2 logs clean-shop --lines 100 \| grep campaign` |
| Занадто багато відправок / rate limit | Зменшіть batch size або збільшіть інтервал cron |
| Клієнт отримує дублікати | Перевірте що `unsubscribed` клієнти виключені з вибірки |
