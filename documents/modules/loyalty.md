# Модуль лояльності та промо

## Огляд

Система лояльності включає бальну програму з рівнями, персональні ціни, знижкові коди, реферальну програму та промо-товари.

## Бальна програма

### Нарахування балів

**Базова ставка:** 1 бал за 1 грн (BASE_POINTS_RATE = 1)

**Множник рівня:** бали = orderAmount * BASE_POINTS_RATE * levelMultiplier

Бали нараховуються автоматично при зміні статусу замовлення на `completed`.

### Списання балів

Клієнт може вказати `loyaltyPointsToSpend` при оформленні замовлення. Перевіряється достатність балів.

### Повернення балів

При скасуванні або поверненні замовлення нараховані бали автоматично повертаються.

## Рівні лояльності

### Модель LoyaltyLevel

```
LoyaltyLevel {
  name              String (unique)
  minSpent          Decimal  // мін. витрачена сума
  pointsMultiplier  Float    // множник балів (default 1.0)
  discountPercent   Decimal  // знижка %
  benefits          Json?    // додаткові переваги
  sortOrder         Int
}
```

### Автоматичний перехід

Після кожного нарахування балів викликається `recalculateLevel(userId)`:
1. Завантажує всі рівні (sorted by sortOrder)
2. Порівнює `totalSpent` з `minSpent` кожного рівня
3. Призначає найвищий досягнутий рівень

## Обліковий запис лояльності

### Модель LoyaltyAccount (1:1 з User)

```
LoyaltyAccount {
  userId     -> User (unique)
  points     Int (default 0)
  totalSpent Decimal (default 0)
  level      String (default "bronze")
}
```

Автоматичне створення при першому зверненні (`getOrCreateLoyaltyAccount`).

## Транзакції балів

### Модель LoyaltyTransaction

```
LoyaltyTransaction {
  userId      -> User
  type        String  // 'earn' | 'spend' | 'manual_add' | 'manual_deduct' | 'expire'
  points      Int     // додатний для earn/add, від'ємний для spend/deduct
  orderId     Int?
  description String
}
```

### Типи транзакцій

| Тип | Опис | Знак |
|-----|------|------|
| `earn` | Нарахування за замовлення | + |
| `spend` | Списання при замовленні | - |
| `manual_add` | Ручне нарахування (адмін) | + |
| `manual_deduct` | Ручне списання (адмін) | - |
| `expire` | Закінчення терміну | - |

## API лояльності

### Клієнтські ендпоінти

**Дашборд лояльності:** `GET /api/v1/me/loyalty`

Повертає:
```json
{
  "account": { "points": 500, "totalSpent": 15000, "level": "silver" },
  "currentLevel": { "name": "silver", "minSpent": 10000, "discountPercent": 3, "pointsMultiplier": 1.5 },
  "nextLevel": { "name": "gold", "minSpent": 50000, "discountPercent": 5, "pointsMultiplier": 2 },
  "recentTransactions": [...]
}
```

**Історія транзакцій:** `GET /api/v1/me/loyalty/transactions`

### Адмін ендпоінти

**Ручна корекція:** `POST /api/v1/admin/loyalty/adjust`
```json
{
  "userId": 123,
  "type": "manual_add",
  "points": 100,
  "description": "Бонус за відгук"
}
```

**Налаштування рівнів:** `PUT /api/v1/admin/loyalty/levels`
```json
{
  "levels": [
    { "name": "bronze", "minSpent": 0, "pointsMultiplier": 1, "discountPercent": 0, "sortOrder": 0 },
    { "name": "silver", "minSpent": 10000, "pointsMultiplier": 1.5, "discountPercent": 3, "sortOrder": 1 },
    { "name": "gold", "minSpent": 50000, "pointsMultiplier": 2, "discountPercent": 5, "sortOrder": 2 }
  ]
}
```

## Персональні ціни

### Модель PersonalPrice

```
PersonalPrice {
  userId          -> User
  productId       -> Product? // для конкретного товару
  categoryId      Int?        // для цілої категорії
  discountPercent Decimal?    // знижка %
  fixedPrice      Decimal?    // або фіксована ціна
  validFrom       DateTime?
  validUntil      DateTime?
  createdBy       -> User     // хто призначив
}
```

### Пріоритет
1. Фіксована ціна (`fixedPrice`) -- найвищий
2. Знижка (`discountPercent`) -- від роздрібної ціни

### Перевірка діапазону дат
Ціна активна тільки якщо `validFrom <= now <= validUntil` (або якщо дати не вказані).

### Адмін-панель

- `GET /api/v1/admin/personal-prices` -- список
- `POST /api/v1/admin/personal-prices` -- створення
- `PUT /api/v1/admin/personal-prices/:id` -- оновлення
- `DELETE /api/v1/admin/personal-prices/:id` -- видалення

## Реферальна програма

### Модель Referral

```
Referral {
  referrerUserId  -> User  // хто запросив
  referredUserId  -> User  // хто прийшов
  referralCode    String
  status          ReferralStatus
  bonusType       String?  // 'points'
  bonusValue      Decimal? // кількість балів
  bonusOrderId    Int?
  convertedAt     DateTime?
}
```

### Статуси реферала

```
registered -> first_order -> bonus_granted
```

| Статус | Опис |
|--------|------|
| `registered` | Запрошений зареєструвався |
| `first_order` | Зробив перше замовлення |
| `bonus_granted` | Бонус нараховано рефереру |

### Процес

1. При реєстрації генерується унікальний `referralCode`
2. Новий користувач вказує код при реєстрації
3. Створюється запис Referral (status: registered)
4. При першому завершеному замовленні:
   - status -> first_order, convertedAt = now
   - Рефереру нараховується 100 балів лояльності
   - status -> bonus_granted

### Ендпоінти

**Клієнт:**
- `GET /api/v1/me/referral` -- мій реферальний код та статистика

**Адмін:**
- `GET /api/v1/admin/referrals` -- список всіх рефералів

## Промо-товари

### Промо-поля в Product

- `isPromo` -- позначка промо
- `promoStartDate` / `promoEndDate` -- період дії
- `priceRetailOld` -- стара ціна (для перекресленої ціни)

### Промо-бейджі

Тип бейджу `promo` автоматично відображається на промо-товарах.

### Ендпоінти

- `GET /api/v1/products/promo` -- список промо-товарів
- Telegram bot: `/promo` -- акційні товари
- Viber bot: кнопка "Акції"

## Оптові правила

### Модель WholesaleRule

```
WholesaleRule {
  ruleType  WholesaleRuleType
  productId -> Product?  // null = глобальне правило
  value     Decimal
  isActive  Boolean
}
```

### Типи правил

| Тип | Опис | Приклад |
|-----|------|---------|
| `min_order_amount` | Мінімальна сума | value=5000 -- мін. 5000 грн |
| `min_quantity` | Мінімальна кількість | value=10 -- мін. 10 шт. |
| `multiplicity` | Кратність | value=6 -- тільки по 6, 12, 18... |

### Адмін-панель

`src/app/(admin)/admin/wholesale-rules/page.tsx`

## Файли модуля

- `src/services/loyalty.ts` -- бали, рівні, транзакції
- `src/services/personal-price.ts` -- персональні ціни
- `src/services/referral.ts` -- реферальна програма
- `src/validators/loyalty.ts` -- Zod-схеми
- `src/validators/personal-price.ts` -- валідація персональних цін
- `src/validators/referral.ts` -- валідація рефералів
- `src/app/(shop)/account/loyalty/page.tsx` -- UI лояльності
- `src/app/(shop)/account/referral/page.tsx` -- UI рефералів
- `src/app/(admin)/admin/loyalty/page.tsx` -- адмін лояльності
- `src/app/(admin)/admin/personal-prices/page.tsx` -- адмін персональних цін
- `src/app/(admin)/admin/referrals/page.tsx` -- адмін рефералів
- `src/app/(admin)/admin/wholesale-rules/page.tsx` -- адмін оптових правил
