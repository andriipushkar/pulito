# 24 — Feature Flags

Контрольоване увімкнення/вимкнення функцій без деплою коду.

## Крок 1 — Як працює

```
Адмін створює flag → Зберігається в БД → Код перевіряє flag при виконанні
                                       → Redis кеш (щоб не смикати БД)
```

Feature flags дозволяють:
- Поступово розкочувати нові функції (gradual rollout)
- A/B тестування
- Вимикати проблемні функції без деплою
- Різні функції для різних тарифних планів

## Крок 2 — Створення flags через адмін-панель

Адмін-панель: **Налаштування → Feature Flags**

Або через API:

```bash
# Створити flag
curl -X POST http://localhost:3000/api/v1/admin/feature-flags \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "new-checkout-flow",
    "name": "Новий процес оформлення",
    "enabled": false,
    "rolloutPercentage": 0,
    "description": "Оновлений checkout з одним кроком"
  }'

# Увімкнути для 10% користувачів
curl -X PATCH http://localhost:3000/api/v1/admin/feature-flags/new-checkout-flow \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "rolloutPercentage": 10
  }'

# Увімкнути для всіх
curl -X PATCH http://localhost:3000/api/v1/admin/feature-flags/new-checkout-flow \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rolloutPercentage": 100
  }'
```

## Крок 3 — Використання в коді

### Backend (API routes, services)

```typescript
import { isFeatureEnabled } from '@/services/feature-flags';

// Проста перевірка
if (await isFeatureEnabled('new-checkout-flow')) {
  // новий код
} else {
  // старий код
}

// З контекстом користувача (для gradual rollout)
if (await isFeatureEnabled('new-checkout-flow', { userId: user.id })) {
  // новий код для цього користувача
}
```

### Frontend (React components)

```tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

function CheckoutPage() {
  const newCheckout = useFeatureFlag('new-checkout-flow');

  if (newCheckout) {
    return <NewCheckoutFlow />;
  }
  return <LegacyCheckoutFlow />;
}
```

## Крок 4 — Типи flags

| Тип | Поведінка | Приклад |
|-----|----------|---------|
| Boolean | Увімкнено/вимкнено | `maintenance-banner` |
| Percentage | Увімкнено для N% користувачів | `new-checkout-flow` (10%) |
| Plan-based | Увімкнено для певних тарифних планів | `email-campaigns` (Standard+) |

## Крок 5 — Список стандартних flags

Ці flags вже використовуються в коді:

| Key | Опис | Default |
|-----|------|---------|
| `email-campaigns` | Email-кампанії та послідовності | `true` |
| `loyalty-program` | Програма лояльності та бали | `true` |
| `marketplace-sync` | Синхронізація з маркетплейсами | `true` |
| `push-notifications` | Web push сповіщення | `true` |
| `instagram-feed` | Instagram віджет на сайті | `true` |
| `advanced-analytics` | Розширена аналітика (predictions, recommendations) | `false` |
| `1c-integration` | Інтеграція з 1С | `false` |

## Troubleshooting

| Проблема | Рішення |
|----------|---------|
| Flag не застосовується | Перезапустіть Redis кеш: `redis-cli FLUSHDB` |
| Rollout percentage не працює | Перевірте що `userId` передається при перевірці |
| Flag видалений але функція працює | Очистіть Redis кеш і перезапустіть додаток |
