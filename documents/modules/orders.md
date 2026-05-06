# Модуль замовлень

## Огляд

Модуль реалізує повний цикл замовлення: створення, зміна статусу, валідація гуртових правил, управління залишками, сповіщення через Telegram та нарахування балів лояльності.

## Статуси замовлення

```
new_order -> processing -> confirmed -> paid -> shipped -> completed
                |             |          |                    |
                v             v          v                    v
            cancelled     cancelled   cancelled            returned
```

### Матриця переходів

| Поточний статус | Дозволені переходи             |
| --------------- | ------------------------------ |
| `new_order`     | `processing`, `cancelled`      |
| `processing`    | `confirmed`, `cancelled`       |
| `confirmed`     | `paid`, `shipped`, `cancelled` |
| `paid`          | `shipped`, `cancelled`         |
| `shipped`       | `completed`, `returned`        |
| `completed`     | `returned`                     |
| `cancelled`     | -- (фінальний)                 |
| `returned`      | -- (фінальний)                 |

### Права на зміну статусу

- **Клієнт:** може скасувати тільки в статусах `new_order` та `processing`
- **Менеджер:** може змінювати відповідно до матриці
- **Система/Cron:** автоматичні переходи

## Створення замовлення

**Endpoint:** `POST /api/v1/orders` (авторизований) або `POST /api/v1/orders/guest` (гостьовий)

### Вхідні дані (checkoutSchema)

```json
{
  "contactName": "Iван Iванов",
  "contactPhone": "+380991234567",
  "contactEmail": "ivan@example.com",
  "companyName": "ТОВ Компанія",
  "edrpou": "12345678",
  "deliveryMethod": "nova_poshta",
  "deliveryCity": "city-ref-uuid",
  "deliveryWarehouseRef": "warehouse-ref-uuid",
  "deliveryAddress": "Відділення №5: вул. Хрещатик, 1",
  "deliveryStreetRef": "street-uuid",
  "deliveryBuilding": "12",
  "deliveryFlat": "5",
  "paymentMethod": "online",
  "comment": "Коментар до замовлення",
  "loyaltyPointsToSpend": 100,
  "paymentProvider": "apple_pay"
}
```

**B2B-поля** (`companyName`, `edrpou`) — опційні, але якщо вказані, тригерять авто-генерацію PDF-інвойсу при переході в `confirmed`.

**D2D-поля** (`deliveryStreetRef`, `deliveryBuilding`, `deliveryFlat`) — опційні, замість `deliveryWarehouseRef` для адресної кур'єрської доставки НП.

**`paymentProvider`** значення: `liqpay`, `liqpay_paypart`, `monobank`, `wayforpay`, `apple_pay`, `google_pay`. Apple/Google Pay автоматично роутяться через WFP (пріоритет) або LiqPay.

### Процес створення

1. **Перевірка кошика** -- не порожній
2. **Валідація гуртових правил** (для wholesale):
   - `min_order_amount` -- мінімальна сума замовлення
   - `min_quantity` -- мінімальна кількість для товару
   - `multiplicity` -- кратність замовлення
3. **Транзакція:**
   - Перевірка та декремент залишків кожного товару
   - Створення замовлення з позиціями
   - Створення першого запису в StatusHistory
4. **Після транзакції:**
   - Очищення серверного кошика (авторизовані)
   - Сповіщення менеджера через Telegram (асинхронно)

### Номер замовлення

Генерується автоматично: `YYYYMMDD-XXXX` (дата + 4 випадкові цифри).

### Гостьове замовлення

Додатково приймає `items` -- масив `{ productId, quantity }`.

## Перегляд замовлень

### Клієнт

- `GET /api/v1/orders` -- список (з пагінацією та фільтрами)
- `GET /api/v1/orders/:id` -- деталі (перевірка власності)

### Адмін/Менеджер

- `GET /api/v1/admin/orders` -- список всіх з пошуком
- `GET /api/v1/admin/orders/:id` -- деталі будь-якого замовлення

### Фільтри (orderFilterSchema)

| Параметр   | Тип    | Опис                                   |
| ---------- | ------ | -------------------------------------- |
| `page`     | number | Сторінка (за замовчуванням 1)          |
| `limit`    | number | Кількість (1-100, за замовчуванням 20) |
| `status`   | enum   | Фільтр за статусом                     |
| `search`   | string | Пошук (номер, ім'я, телефон)           |
| `dateFrom` | string | Дата від                               |
| `dateTo`   | string | Дата до                                |

## Зміна статусу

**Endpoints:**

- `PUT /api/v1/orders/:id/status` -- клієнт (тільки скасування)
- `PUT /api/v1/admin/orders/:id/status` -- менеджер/адмін

### Процес зміни

1. Перевірка дозволеного переходу за матрицею
2. Перевірка прав (клієнт vs менеджер)
3. **Транзакція:**
   - Повернення залишків при `cancelled` або `returned`
   - Оновлення статусу
   - Запис в OrderStatusHistory
4. **Після транзакції:**
   - **Auto-create TTN** для NP-замовлень при `confirmed`/`shipped` без `trackingNumber` (з COD-сумою якщо `paymentMethod='cod' && paymentStatus !== 'paid'`, з D2D fields якщо `deliveryStreetRef + deliveryBuilding`)
   - **Auto-email B2B-інвойсу** при `confirmed` для замовлень з `companyName`/`edrpou` і `contactEmail` (HTML-escape для XSS-protection)
   - Сповіщення клієнта через Telegram (асинхронно)
   - При `completed`:
     - Нарахування балів лояльності
     - Оновлення реферального статусу + бонус рефереру (100 балів)
   - При `cancelled`/`returned`:
     - Повернення нарахованих балів лояльності

## Редагування позицій замовлення

**Endpoint:** `PUT /api/v1/admin/orders/:id/items`

Доступно тільки в статусах: `new_order`, `processing`, `confirmed`.

### Операції

- **Видалення позиції:** повернення залишків на склад
- **Зміна кількості:** перевірка наявності, коригування залишків
- **Додавання нового товару:** перевірка наявності, декремент залишків

Після редагування автоматично перераховуються `totalAmount` та `itemsCount`.

## Історія статусів

Кожна зміна статусу записується в `OrderStatusHistory`:

- `oldStatus`, `newStatus`
- `changedBy` -- ID користувача
- `changeSource` -- `manager`, `client`, `system`, `cron`
- `comment` -- коментар до зміни
- `ipAddress`

## Джерела замовлень

| Джерело        | Опис                          |
| -------------- | ----------------------------- |
| `web`          | Через сайт (за замовчуванням) |
| `telegram_bot` | Через Telegram бота           |
| `viber_bot`    | Через Viber бота              |

## UTM-мітки

Замовлення зберігає UTM-параметри для аналітики маркетингових кампаній:

- `utmSource`, `utmMedium`, `utmCampaign`
- `ipAddress`, `userAgent`

## Pay later (для online замовлень)

Якщо клієнт оформив замовлення з `paymentMethod='online'` і `paymentStatus='pending'` (наприклад, не дочекався webhook'у або закрив сторінку), він може **повторно ініціювати оплату** з кабінету:

- UI: `/account/orders/[id]` показує кнопки "Сплатити LiqPay / Monobank / WayForPay" коли умови виконано (online + не paid + не cancelled).
- Endpoint: `POST /api/v1/orders/:id/pay` приймає `{ provider }`, повертає `{ redirectUrl }`.
- Вибір провайдера відрізняється від оригінального — клієнт може спробувати інший gateway.

## B2B-поля у моделі Order

```
companyName  String?  -- юридична назва ТОВ/ФОП
edrpou       String?  -- ЄДРПОУ (8 цифр)
```

Раніше валідувалися у Zod-схемі, але **не зберігалися** на Order — це був баг (втрачали ЄДРПОУ, не могли згенерувати B2B-інвойс). Виправлено міграцією `20260506000000_add_order_b2b_fields`.

## Файли модуля

- `src/services/order.ts` — основна логіка (create, list, status change, edit items, auto-TTN, B2B email)
- `src/validators/order.ts` — Zod-схеми (checkout з D2D + B2B полями, filter, status update, guest checkout)
- `src/app/api/v1/orders/` — клієнтські ендпоінти
- `src/app/api/v1/orders/[id]/pay/route.ts` — pay-later endpoint
- `src/app/api/v1/admin/orders/` — адмін ендпоінти
- `src/app/api/v1/admin/orders/bulk-ttn/route.ts` — масове створення TTN
- `src/app/(shop)/account/orders/` — UI сторінки замовлень + pay-later кнопки + tracking-status
- `src/app/(admin)/admin/orders/` — адмін UI з checkbox-ами для bulk TTN
