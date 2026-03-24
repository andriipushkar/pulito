# 21 — Тарифні плани та білінг

Налаштування SaaS тарифних планів, інвойсів і оплати підписки для tenant-ів.

## Крок 1 — Змінні оточення

```env
# Білінг
BILLING_ENABLED=true
BILLING_CURRENCY=UAH
BILLING_TRIAL_DAYS=14
BILLING_INVOICE_PREFIX=INV
```

## Крок 2 — Створення тарифних планів

Через адмін API:

```bash
# Free plan
curl -X POST http://localhost:3000/api/v1/admin/billing/plans \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Free",
    "slug": "free",
    "price": 0,
    "interval": "month",
    "limits": {
      "products": 50,
      "orders_per_month": 100,
      "storage_mb": 500,
      "custom_domain": false,
      "email_campaigns": false
    }
  }'

# Standard plan
curl -X POST http://localhost:3000/api/v1/admin/billing/plans \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Standard",
    "slug": "standard",
    "price": 499,
    "interval": "month",
    "limits": {
      "products": 1000,
      "orders_per_month": 5000,
      "storage_mb": 5000,
      "custom_domain": true,
      "email_campaigns": true
    }
  }'

# Pro plan
curl -X POST http://localhost:3000/api/v1/admin/billing/plans \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pro",
    "slug": "pro",
    "price": 1499,
    "interval": "month",
    "limits": {
      "products": -1,
      "orders_per_month": -1,
      "storage_mb": 50000,
      "custom_domain": true,
      "email_campaigns": true
    }
  }'
```

> `-1` означає безлімітно.

## Крок 3 — Оплата підписки

Білінг використовує ті ж платіжні провайдери що й магазин (LiqPay, Monobank, WayForPay). Переконайтесь що вони налаштовані → [05-payment-providers.md](05-payment-providers.md).

Процес оплати:

```
Tenant обирає план → Створюється інвойс → Оплата через LiqPay/Mono
                                        → Webhook підтверджує оплату
                                        → План активується
                                        → Наступний інвойс через interval
```

## Крок 4 — Автоматичні інвойси

Cron-задача `process-subscriptions` (вже додана в [02-production-vps.md](02-production-vps.md)) щогодини:

1. Знаходить підписки що закінчуються
2. Створює інвойс
3. Відправляє email з посиланням на оплату
4. Якщо не оплачено за 3 дні — нагадування
5. Якщо не оплачено за 7 днів — downgrade на Free

## Крок 5 — API ендпоінти білінгу

| Метод | Endpoint | Для кого |
|-------|----------|----------|
| GET | `/api/v1/admin/billing/plans` | Super admin — список планів |
| POST | `/api/v1/admin/billing/plans` | Super admin — створити план |
| GET | `/api/v1/tenant/billing` | Tenant admin — поточний план і інвойси |
| POST | `/api/v1/tenant/billing/subscribe` | Tenant admin — обрати/змінити план |
| GET | `/api/v1/tenant/billing/invoices` | Tenant admin — історія інвойсів |

## Troubleshooting

| Проблема | Рішення |
|----------|---------|
| Інвойси не створюються | Перевірте що cron `process-subscriptions` запущено |
| Webhook оплати не приходить | Перевірте URL webhook у налаштуваннях платіжного провайдера |
| Tenant не може перевищити ліміт | Це нормально — поверніть 403 з повідомленням про апгрейд плану |
| Trial не закінчується | Перевірте `BILLING_TRIAL_DAYS` і що cron працює |
